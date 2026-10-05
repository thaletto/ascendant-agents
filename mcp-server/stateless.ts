import type { IncomingMessage, ServerResponse } from "node:http";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { buildMcpServer } from "./handlers.ts";

const server = buildMcpServer();

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Array<Buffer> = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Stateless Streamable HTTP handler: no session IDs, every request is
 * self-contained. Safe to serve from serverless (Vercel) or any host —
 * no affinity or shared memory required.
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "GET" || req.method === "DELETE") {
    res.writeHead(405).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let body: unknown;
  try {
    const preParsed = (req as { body?: unknown }).body;
    body = preParsed !== undefined ? preParsed : await parseJsonBody(req);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // Stateless mode per SDK docs. The cast is only for
  // exactOptionalPropertyTypes, which rejects an explicit undefined.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined as unknown as () => string,
  });
  res.on("close", () => transport.close());
  await server.connect(transport as Transport);
  await transport.handleRequest(req, res, body);
}
