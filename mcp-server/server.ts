import * as Http from "node:http";

import { handleMcpRequest } from "./stateless.ts";

const port = Number(process.env["PORT"] ?? 3000);

const httpServer = Http.createServer((req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }
  handleMcpRequest(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

httpServer.listen(port, () => {
  console.log(`ascendant MCP listening on :${port}/mcp (stateless)`);
});
