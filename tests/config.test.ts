import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadConfig,
  resolveSessionRecordingsDir,
  resolveSessionWritingDir,
  getProjectRoot,
} from "../src/config/index.js";

test("loadConfig should return valid default configuration", () => {
  const config = loadConfig();
  assert.ok(typeof config.audioStorageDir === "string");
  assert.ok(typeof config.writingStorageDir === "string");
  assert.ok(typeof config.webServerPort === "number");
  assert.ok(typeof config.autoOpenBrowser === "boolean");
  assert.ok(typeof config.httpTransportPort === "number");
});

test("resolveSessionRecordingsDir should resolve relative and custom paths", () => {
  const sessionId = "test_session_123";
  const resolved = resolveSessionRecordingsDir(sessionId);

  assert.ok(path.isAbsolute(resolved));
  assert.ok(resolved.includes(sessionId));
  assert.ok(resolved.includes("recordings"));
  assert.ok(fs.existsSync(resolved));

  // Test custom override
  const customOverride = path.join(getProjectRoot(), "scratch", "custom_recordings");
  const resolvedCustom = resolveSessionRecordingsDir(sessionId, customOverride);

  assert.ok(resolvedCustom.includes("custom_recordings"));
  assert.ok(fs.existsSync(resolvedCustom));

  // Clean up test directories
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.rmSync(resolvedCustom, { recursive: true, force: true });
});

test("resolveSessionWritingDir should resolve to writings folder and respect overrides", () => {
  const sessionId = "wrt_test_session_456";
  const resolved = resolveSessionWritingDir(sessionId);

  assert.ok(path.isAbsolute(resolved));
  assert.ok(resolved.includes(sessionId));
  assert.ok(resolved.includes("writings"));
  assert.ok(fs.existsSync(resolved));

  // Test custom override
  const customOverride = path.join(getProjectRoot(), "scratch", "custom_writings");
  const resolvedCustom = resolveSessionWritingDir(sessionId, customOverride);

  assert.ok(resolvedCustom.includes("custom_writings"));
  assert.ok(fs.existsSync(resolvedCustom));

  // Clean up test directories
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.rmSync(resolvedCustom, { recursive: true, force: true });
});

