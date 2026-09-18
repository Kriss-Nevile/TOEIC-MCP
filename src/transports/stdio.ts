import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stopWebServer } from "../web/server.js";

/**
 * Ensures the MCP server process exits cleanly and never becomes an orphaned zombie.
 */
function setupLifelineWatchdog(transport: StdioServerTransport): void {
  let isShuttingDown = false;

  const terminate = async (reason: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.error(`[TOEIC Trainer MCP] Shutting down (${reason})...`);
    try {
      await stopWebServer();
      await transport.close().catch(() => {});
    } finally {
      process.exit(0);
    }
  };

  // 1. Stdio stream closure / EOF / broken pipe
  process.stdin.on("close", () => terminate("stdin closed"));
  process.stdin.on("end", () => terminate("stdin EOF"));
  process.stdin.on("error", (err: any) => terminate(`stdin error: ${err?.message || err}`));

  process.stdout.on("error", (err: any) => {
    if (err?.code === "EPIPE") {
      terminate("stdout EPIPE (broken pipe)");
    }
  });

  // 2. Transport closure callback
  transport.onclose = () => {
    terminate("MCP transport closed");
  };

  // 3. Process signals (including Windows console termination)
  process.on("SIGINT", () => terminate("SIGINT"));
  process.on("SIGTERM", () => terminate("SIGTERM"));
  process.on("SIGHUP", () => terminate("SIGHUP"));
  process.on("SIGBREAK", () => terminate("SIGBREAK"));

  // 4. Windows Parent Process Watchdog
  // On Windows, if the parent process (IDE or cmd.exe) terminates abruptly,
  // child processes are orphaned without signals. We poll the parent PID:
  const parentPid = process.ppid;
  if (parentPid && parentPid > 1) {
    const ppidTimer = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch (err: any) {
        if (err?.code === "ESRCH") {
          terminate(`parent process ${parentPid} exited`);
        }
      }
    }, 1000);
    ppidTimer.unref(); // Must not prevent the event loop from exiting naturally
  }
}

export async function runStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  setupLifelineWatchdog(transport);
  await server.connect(transport);
  console.error("[TOEIC Trainer MCP] Stdio transport connected and listening.");
}
