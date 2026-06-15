// Parser for BCA "Internet Transaction Journal" (myBCA) emails.
// One email = one transaction. Pure functions only (no I/O) so it can be
// unit-tested with Node and reused inside the Deno edge function.

export interface ParsedTxn {
  date: string; // ISO YYYY-MM-DD
  amount: number; // integer rupiah
  description: string; // uppercased merchant, matches merchant_mapping keywords
  type: "DB" | "CR"; // DB = outgoing/expense, CR = incoming/gain
  ref: string; // Reference No. — used for dedup
  raw: Record<string, string>; // every label/value we managed to read, for debugging
}

// English + common Indonesian month abbreviations.
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mrt: 3, apr: 4, may: 5, mei: 5, jun: 6,
  jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, sept: 9, oct: 10, okt: 10,
  nov: 11, dec: 12, des: 12,
};

// Known field labels. Longer/more-specific labels MUST come before shorter
// ones that are substrings of them (e.g. "Company/Product Name" before "Name")
// so the regex alternation stops at the right boundary.
const LABELS = [
  "Status",
  "Transaction Date",
  "Transaction Type",
  "Transfer Type",
  "Source of Fund",
  "BCA Virtual Account No\\.",
  "Company/Product Name",
  "Merchant Name",
  "Beneficiary Name",
  "Beneficiary",
  "Name",
  "Payment to",
  "Pay Amount",
  "Total Payment",
  "Description",
  "Reference No\\.",
  "Note\\(s\\)",
];
const STOP = LABELS.join("|");

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(tr|td|th|p|div|table|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Capture a field's value: everything between "Label :" and the next known
// label (or end). Works whether fields are on separate lines or run together.
function extract(
  text: string,
  label: string,
  opts: { notAfterLetter?: boolean } = {},
): string | null {
  const pre = opts.notAfterLetter ? "(?<![A-Za-z/])" : "";
  const re = new RegExp(
    pre + label + "\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:" + STOP + ")\\s*:|$)",
    "i",
  );
  const m = text.match(re);
  const v = m ? m[1].trim() : null;
  return v || null;
}

// "IDR 15,000.00" / "Rp15.000,00" / "15,000" -> integer rupiah.
export function parseAmount(v: string): number {
  let s = v.replace(/[^0-9.,]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let sep = lastComma > lastDot ? "," : lastDot > -1 ? "." : "";
  if (sep) {
    const after = s.slice(s.lastIndexOf(sep) + 1);
    if (after.length === 3) sep = ""; // it was a thousands group, not decimals
  }
  if (sep === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (sep === ".") s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  return Math.round(parseFloat(s));
}

// "12 Jun 2026 14:41:13" -> "2026-06-12".
export function parseDate(v: string): string | null {
  const m = v.match(/(\d{1,2})\s+([A-Za-z]{3,4})\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (!mon) return null;
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBcaEmail(rawBody: string): ParsedTxn | null {
  const text = htmlToText(rawBody);

  const raw: Record<string, string> = {};
  for (const label of LABELS) {
    const key = label.replace(/\\/g, "");
    const val = extract(text, label, { notAfterLetter: label === "Name" });
    if (val) raw[key] = val;
  }

  const dateRaw = raw["Transaction Date"];
  const amountRaw = raw["Total Payment"] || raw["Pay Amount"];
  const ref = raw["Reference No."] || "";

  const date = dateRaw ? parseDate(dateRaw) : null;
  const amount = amountRaw ? parseAmount(amountRaw) : NaN;

  // Require the essentials; skip anything we can't trust rather than mis-import.
  if (!date || !amount || !isFinite(amount) || !ref) return null;

  // Default to expense (DB). Flip to CR only for clear incoming-funds wording.
  let type: "DB" | "CR" = "DB";
  if (/you (have )?received|dana masuk|incoming fund|kredit masuk/i.test(text)) {
    type = "CR";
  }

  return {
    date,
    amount,
    description: buildDescription(raw),
    type,
    ref,
    raw,
  };
}

// Build a never-empty, human-readable description: "<Transfer Type> - <merchant>".
// Falls back through merchant/type fields so non-payment email variants (which
// lack Company/Product Name) still get a meaningful label instead of blank.
function buildDescription(raw: Record<string, string>): string {
  const merchant = raw["Company/Product Name"] || raw["Merchant Name"] ||
    raw["Beneficiary Name"] || raw["Beneficiary"] || raw["Name"] ||
    raw["Payment to"] || "";
  const type = raw["Transfer Type"] || raw["Transaction Type"] || "";

  const parts: string[] = [];
  if (type) parts.push(type);
  if (merchant) parts.push(merchant);

  const desc = parts.join(" - ") || raw["Description"] || "PAYMENT";
  return desc.toUpperCase().replace(/\s+/g, " ").trim();
}
