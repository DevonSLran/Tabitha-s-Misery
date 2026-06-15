// Edge Function: import-bca-emails
//
// Two actions (POST JSON):
//   { action:"scan",   from:"YYYY-MM", to:"YYYY-MM", gmailUser, gmailPassword }
//       -> IMAP-fetch BCA "Internet Transaction Journal" emails, parse each,
//          flag which are already imported. Inserts nothing.
//          Returns { found, transactions:[{date,description,amount,type,ref,alreadyImported}] }
//
//   { action:"import", transactions:[{date,description,amount,type,ref}] }
//       -> insert exactly the rows the client sends (after the user has
//          reviewed/edited/selected them), deduped by ref via the unique index.
//          Returns { imported, skipped, invalid }
//
// Inserted rows land in bca_transactions, which the int_bca_categorized view
// auto-categorizes via merchant_mapping.

import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.7.1";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseBcaEmail, type ParsedTxn } from "./parser.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// from="2026-05", to="2026-06" -> since=2026-05-01, before=2026-07-01 (exclusive)
function monthBounds(from: string, to: string): { since: Date; before: Date } {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const since = new Date(Date.UTC(fy, fm - 1, 1));
  const before = new Date(Date.UTC(tm === 12 ? ty + 1 : ty, tm === 12 ? 0 : tm, 1));
  return { since, before };
}

// Only imported rows have ref_no set, so this set stays small. Fetch it whole
// and compare in memory — avoids putting arbitrary reference strings (which can
// contain URL-breaking characters) into a PostgREST filter.
async function getExistingRefs(db: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("bca_transactions")
    .select("ref_no")
    .eq("user_id", userId)
    .not("ref_no", "is", null);
  if (error) {
    throw new Error(
      `${error.message}${error.hint ? " | " + error.hint : ""}${error.code ? " | code=" + error.code : ""}`,
    );
  }
  const s = new Set<string>();
  for (const r of data ?? []) if (r.ref_no) s.add(r.ref_no as string);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Optional shared-secret gate (set IMPORT_SHARED_SECRET to enable).
  const requiredSecret = Deno.env.get("IMPORT_SHARED_SECRET");
  if (requiredSecret && req.headers.get("x-import-secret") !== requiredSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: {
    action?: string;
    from?: string;
    to?: string;
    gmailUser?: string;
    gmailPassword?: string;
    senderFilter?: string;
    transactions?: Array<Record<string, unknown>>;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = payload.action || (Array.isArray(payload.transactions) ? "import" : "scan");

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Identify the calling user from their JWT (the app sends the user's access
  // token). Inserts use the service role, so we stamp user_id ourselves.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "Not signed in" }, 401);

  // ---- IMPORT: insert exactly the client-curated rows ----
  if (action === "import") {
    const incoming = Array.isArray(payload.transactions) ? payload.transactions : [];
    if (!incoming.length) return json({ error: "No transactions to import" }, 400);

    // Rows are written to the base table bca_transactions; the stg + categorized
    // views surface them to the app. We store full ISO dates in `date`.
    const valid: Array<{ date: string; description: string; amount: number; type: string; ref_no: string; user_id: string }> = [];
    let invalid = 0;
    for (const t of incoming) {
      const date = String(t.date ?? "");
      const amount = Math.round(Number(t.amount));
      const type = t.type === "CR" ? "CR" : t.type === "DB" ? "DB" : null;
      const ref = String(t.ref ?? "").trim();
      const description = String(t.description ?? "").toUpperCase().replace(/\s+/g, " ").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFinite(amount) || amount <= 0 || !type || !ref) {
        invalid++;
        continue;
      }
      valid.push({ date, description, amount, type, ref_no: ref, user_id: userId });
    }

    let existing: Set<string>;
    try {
      existing = await getExistingRefs(db, userId);
    } catch (e) {
      return json({ error: "DB lookup failed", detail: String(e) }, 500);
    }

    const fresh = valid.filter((r) => !existing.has(r.ref_no));
    let imported = 0;
    if (fresh.length) {
      const { error } = await db
        .from("bca_transactions")
        .upsert(fresh, { onConflict: "ref_no", ignoreDuplicates: true });
      if (error) return json({ error: "Insert failed", detail: error.message }, 500);
      imported = fresh.length;
    }
    return json({ imported, skipped: valid.length - fresh.length, invalid });
  }

  // ---- SCAN: fetch + parse emails, flag already-imported, insert nothing ----
  const { from, to, gmailUser, senderFilter: sf } = payload;
  const gmailPassword = (payload.gmailPassword || "").replace(/\s+/g, "");
  const senderFilter = sf || "bca.co.id";

  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return json({ error: "from/to must be 'YYYY-MM'" }, 400);
  }
  if (from > to) return json({ error: "'from' must be <= 'to'" }, 400);
  if (!gmailUser || !gmailPassword) {
    return json({ error: "gmailUser and gmailPassword are required" }, 400);
  }

  const { since, before } = monthBounds(from, to);

  const parsed: ParsedTxn[] = [];
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: gmailUser, pass: gmailPassword },
    logger: false,
  });

  try {
    await client.connect();
  } catch (e) {
    const err = e as { responseText?: string; serverResponseCode?: string; authenticationFailed?: boolean; message?: string };
    const detail = err.responseText || err.serverResponseCode || err.message || String(e);
    const authFail = err.authenticationFailed === true ||
      /AUTHENTICATIONFAILED|Invalid credentials|WEBLOGIN|application-specific/i.test(detail);
    return json(
      {
        error: authFail
          ? "Gmail rejected the credentials. Use your full email + a 16-char App Password (no spaces); 2-Step Verification must be on."
          : "Couldn't reach Gmail IMAP.",
        detail: String(detail),
      },
      authFail ? 401 : 502,
    );
  }

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search(
        { from: senderFilter, since, before },
        { uid: true },
      )) as number[];

      if (uids && uids.length) {
        for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
          try {
            const mail = await simpleParser(msg.source as Uint8Array);
            const body = (mail.html || mail.text || "") as string;
            const txn = parseBcaEmail(body);
            if (txn) parsed.push(txn);
          } catch (_) {
            // Skip individual messages that fail to parse rather than aborting.
          }
        }
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    return json({ error: "IMAP search/fetch failed", detail: String(e) }, 502);
  } finally {
    try {
      await client.logout();
    } catch (_) { /* ignore */ }
  }

  // Collapse duplicate refs within this batch.
  const byRef = new Map<string, ParsedTxn>();
  for (const t of parsed) if (!byRef.has(t.ref)) byRef.set(t.ref, t);
  const unique = [...byRef.values()];

  let existing: Set<string>;
  try {
    existing = await getExistingRefs(db, userId);
  } catch (e) {
    return json({ error: "DB lookup failed", detail: String(e) }, 500);
  }

  const transactions = unique
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) // newest first
    .map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      ref: t.ref,
      alreadyImported: existing.has(t.ref),
    }));

  return json({ found: unique.length, transactions });
});
