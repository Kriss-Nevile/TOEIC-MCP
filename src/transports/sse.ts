import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../config/index.js";

export async function runHttpSseTransport(
  server: McpServer,
  desiredPort?: number
): Promise<{ app: express.Express; port: number }> {
  const config = loadConfig();
  const port = desiredPort || config.httpTransportPort || 3001;
  const app = express();

  app.use(cors());

  // Active SSE transports keyed by sessionId
  const transports = new Map<string, SSEServerTransport>();

  // GET /sse: Establish persistent client session
  app.get("/sse", async (_req, res) => {
    console.error("[SSE Transport] New client connection request received.");
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    transport.onclose = () => {
      console.error(`[SSE Transport] Client disconnected: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    };

    await server.connect(transport);
  });

  // POST /messages: Client messages sent to server
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send("Missing sessionId query parameter");
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send(`Active session not found: ${sessionId}`);
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // Health probe
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      activeSessions: transports.size,
      timestamp: new Date().toISOString(),
    });
  });

  return new Promise((resolve, reject) => {
    const listener = app.listen(port, () => {
      console.error(`[TOEIC Trainer MCP] HTTP SSE Transport running on http://localhost:${port}`);
      console.error(`  - SSE Endpoint:  http://localhost:${port}/sse`);
      console.error(`  - Messages:      http://localhost:${port}/messages`);
      resolve({ app, port });
    });

    listener.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[SSE Transport] Port ${port} in use, trying ${port + 1}...`);
        runHttpSseTransport(server, port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}
