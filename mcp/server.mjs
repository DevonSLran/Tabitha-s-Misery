#!/usr/bin/env node
/* Tabitha's Misery MCP connector, local (stdio) — for Claude Code and Claude Desktop.
 *
 * Signed in as you via the session file (see db.mjs). The tools themselves live
 * in supabase/functions/_shared/tm/tools.mjs, shared with the remote connector.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { db, TM, currentUser } from './db.mjs';
import { registerTools, INSTRUCTIONS, SERVER_INFO } from '../supabase/functions/_shared/tm/tools.mjs';

const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
registerTools(server, { db, TM, z, requireUser: currentUser });
await server.connect(new StdioServerTransport());
