import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadConfig,
  resolveSessionDir,
  resolveSessionRecordingsDir,
  resolveSessionWritingDir,
  getProjectRoot,
} from "../src/config/index.js";

test("loadConfig should return valid default configuration", () => {
  const config = loadConfig();
  assert.ok(typeof config.sessionStorageDir === "string");
  assert.ok(typeof config.audioStorageDir === "string");
  assert.ok(typeof config.writingStorageDir === "string");
  assert.ok(typeof config.webServerPort === "number");
  assert.ok(typeof config.autoOpenBrowser === "boolean");
  assert.ok(typeof config.httpTransportPort === "number");
});

test("resolveSessionDir should resolve to sessions/<sessionId> and respect overrides", () => {
  const sessionId = "test_session_root_123";
  const resolved = resolveSessionDir(sessionId);

  assert.ok(path.isAbsolute(resolved));
  assert.ok(resolved.includes(sessionId));
  assert.ok(resolved.includes("sessions"));
  assert.ok(fs.existsSync(resolved));

  // Custom override
  const customOverride = path.join(getProjectRoot(), "scratch", "custom_sessions");
  const resolvedCustom = resolveSessionDir(sessionId, customOverride);

  assert.ok(resolvedCustom.includes("custom_sessions"));
  assert.ok(fs.existsSync(resolvedCustom));

  // Clean up
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.rmSync(resolvedCustom, { recursive: true, force: true });
});

test("resolveSessionRecordingsDir should resolve relative and custom paths to recordings subfolder", () => {
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
  fs.rmSync(path.dirname(resolved), { recursive: true, force: true });
  fs.rmSync(resolvedCustom, { recursive: true, force: true });
});

test("resolveSessionWritingDir should resolve to writing subfolder and respect overrides", () => {
  const sessionId = "wrt_test_session_456";
  const resolved = resolveSessionWritingDir(sessionId);

  assert.ok(path.isAbsolute(resolved));
  assert.ok(resolved.includes(sessionId));
  assert.ok(resolved.includes("writing"));
  assert.ok(fs.existsSync(resolved));

  // Test custom override
  const customOverride = path.join(getProjectRoot(), "scratch", "custom_writings");
  const resolvedCustom = resolveSessionWritingDir(sessionId, customOverride);

  assert.ok(resolvedCustom.includes("custom_writings"));
  assert.ok(fs.existsSync(resolvedCustom));

  // Clean up test directories
  fs.rmSync(path.dirname(resolved), { recursive: true, force: true });
  fs.rmSync(resolvedCustom, { recursive: true, force: true });
});

