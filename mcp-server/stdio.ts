import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildMcpServer } from "./handlers.ts";

await buildMcpServer().connect(new StdioServerTransport());
