import type { IncomingMessage, ServerResponse } from "node:http";

import { handleMcpRequest } from "../mcp-server/stateless.ts";

/**
 * Vercel serverless function: stateless Streamable HTTP, no sessions.
 * Works on hobby tier — each invocation is self-contained.
 *
 * Deploy: `vercel deploy`. Set no extra config; Vercel serves `api/*.ts`
 * as Node functions. Deployed URL is `https://<project>.vercel.app/api/mcp`
 * — use that (not `/mcp`) in `mcp.json`.
 *
 * Risk: `@swisseph/node` is a native binary. If Vercel's build doesn't
 * bundle it, this fails at runtime — verify with one deploy before
 * submitting the plugin.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleMcpRequest(req, res);
}
