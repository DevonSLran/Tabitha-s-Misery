// Tabitha's Misery MCP connector, remote (Streamable HTTP) — for claude.ai and
// the Claude apps. Same tools as the local connector (../_shared/tm/tools.mjs).
//
// Sign-in is Supabase Auth's OAuth 2.1 server: Claude registers itself, sends
// the user to oauth-consent.html (Site URL + Authorization Path), and calls
// here with the access token it gets. That token is an ordinary Supabase user
// JWT, so a client built with it is held to the user's rows by RLS. No
// service-role key is used.
//
// Deploy (gateway JWT check off, so the 401 + discovery below can be served):
//   supabase functions deploy mcp --no-verify-jwt --project-ref oyexlcmrrhdvsqfbjoif

import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.2.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";
import "../_shared/tm/format.js"; // sets globalThis.TM (copy of js/format.js; npm run sync:fn)
import { INSTRUCTIONS, registerTools, SERVER_INFO } from "../_shared/tm/tools.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESOURCE = `${SUPABASE_URL}/functions/v1/mcp`;
const METADATA_URL = `${RESOURCE}/oauth-protected-resource`;
// deno-lint-ignore no-explicit-any
const TM = (globalThis as any).TM;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "www-authenticate, mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** RFC 9728 metadata: tells Claude which authorization server signs users in. */
function resourceMetadata(): Response {
  return Response.json({
    resource: RESOURCE,
    authorization_servers: [`${SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Tabitha's Misery",
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

/** 401 that points the client at the metadata above (MCP authorization spec). */
function unauthorized(error?: string): Response {
  const params = [`resource_metadata="${METADATA_URL}"`];
  if (error) params.push(`error="${error}"`);
  return Response.json(
    { error: error ?? "unauthorized", error_description: "Sign in to Tabitha's Misery to use this connector." },
    { status: 401, headers: { "WWW-Authenticate": `Bearer ${params.join(", ")}` } },
  );
}

const handle = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (pathname.endsWith("/oauth-protected-resource") || pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return resourceMetadata();
  }

  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return unauthorized();

  // Acting as the caller: every query below runs under their RLS.
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Asking Auth (not just checking the signature) also rejects tokens whose
  // session or grant has been revoked.
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return unauthorized("invalid_token");

  const handler = createMcpHandler(() => {
    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
    registerTools(server, { db, TM, z, requireUser: async () => user });
    return server;
  });
  return handler.fetch(req);
};

Deno.serve(async (req) => {
  try {
    return withCors(await handle(req));
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: "server_error" }, { status: 500 }));
  }
});
