import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distEntryPoint = path.resolve(__dirname, "../dist/index.js");

test("stdio transport shuts down cleanly when stdin pipe closes", async () => {
  const child = spawn(process.execPath, [distEntryPoint, "--transport", "stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Allow server to initialize
  await new Promise((r) => setTimeout(r, 1500));

  const exitPromise = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });

  // Close stdin
  child.stdin.end();

  // Child should exit within 3 seconds
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      child.kill();
      reject(new Error("Timeout waiting for child to exit on stdin closure"));
    }, 4000)
  );

  let stderrOutput = "";
  child.stderr.on("data", (d) => {
    stderrOutput += d.toString();
  });

  const result = await Promise.race([exitPromise, timeoutPromise]);
  if (result.code !== 0) {
    console.error("Child stderr was:", stderrOutput);
  }
  assert.equal(result.code, 0, "Server process should exit with code 0 on stdin close");
});
