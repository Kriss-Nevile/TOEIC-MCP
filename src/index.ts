#!/usr/bin/env node
import { createMcpServer } from "./server.js";
import { runStdioTransport } from "./transports/stdio.js";
import { runHttpSseTransport } from "./transports/sse.js";
import { startWebServer } from "./web/server.js";
import { loadConfig } from "./config/index.js";

async function main() {
  const args = process.argv.slice(2);
  let transportMode: "stdio" | "http" = "stdio";
  let httpPort: number | undefined;
  let webPort: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transport" && args[i + 1]) {
      transportMode = args[i + 1].toLowerCase() as any;
      i++;
    } else if (args[i] === "--port" && args[i + 1]) {
      httpPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--web-port" && args[i + 1]) {
      webPort = parseInt(args[i + 1], 10);
      i++;
    }
  }

  const config = loadConfig();
  console.error(`[TOEIC Trainer MCP] Initializing server (Mode: ${transportMode})...`);
  console.error(`[TOEIC Trainer MCP] Audio Destination: ${config.audioStorageDir}`);

  // Pre-warm the internal web server for the browser app
  await startWebServer(webPort || config.webServerPort);

  const server = createMcpServer();

  if (transportMode === "http") {
    await runHttpSseTransport(server, httpPort || config.httpTransportPort);
  } else {
    await runStdioTransport(server);
  }
}

main().catch((err) => {
  console.error("[TOEIC Trainer MCP] Fatal startup error:", err);
  process.exit(1);
});
