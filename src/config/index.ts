import fs from "node:fs";
import path from "node:path";

export interface ToeicConfig {
  sessionStorageDir: string;
  audioStorageDir?: string;
  writingStorageDir?: string;
  webServerPort: number;
  autoOpenBrowser: boolean;
  httpTransportPort: number;
}

const DEFAULT_CONFIG: ToeicConfig = {
  sessionStorageDir: "./sessions",
  audioStorageDir: "./recordings",
  writingStorageDir: "./writings",
  webServerPort: 3210,
  autoOpenBrowser: true,
  httpTransportPort: 3001,
};

const CONFIG_FILE_NAME = "toeic.config.json";

export function getProjectRoot(): string {
  return process.cwd();
}

export function getConfigFilePath(): string {
  return path.resolve(getProjectRoot(), CONFIG_FILE_NAME);
}

export function loadConfig(): ToeicConfig {
  const filePath = getConfigFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        sessionStorageDir: parsed.sessionStorageDir || DEFAULT_CONFIG.sessionStorageDir,
        audioStorageDir: parsed.audioStorageDir || DEFAULT_CONFIG.audioStorageDir,
        writingStorageDir: parsed.writingStorageDir || DEFAULT_CONFIG.writingStorageDir,
        webServerPort: Number(parsed.webServerPort) || DEFAULT_CONFIG.webServerPort,
        autoOpenBrowser: parsed.autoOpenBrowser !== undefined ? Boolean(parsed.autoOpenBrowser) : DEFAULT_CONFIG.autoOpenBrowser,
        httpTransportPort: Number(parsed.httpTransportPort) || DEFAULT_CONFIG.httpTransportPort,
      };
    } catch (err) {
      console.error("[Config] Warning: Failed to parse toeic.config.json, using defaults.", err);
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(updates: Partial<ToeicConfig>): ToeicConfig {
  const current = loadConfig();
  const next = { ...current, ...updates };
  const filePath = getConfigFilePath();
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

/**
 * Resolves absolute root directory for a session: <sessionStorageDir>/<sessionId>
 * If overrideDir is provided, that base directory takes precedence.
 */
export function resolveSessionDir(sessionId: string, overrideDir?: string): string {
  const config = loadConfig();
  const baseDir = overrideDir || config.sessionStorageDir || "./sessions";
  const resolvedBase = path.isAbsolute(baseDir)
    ? baseDir
    : path.resolve(getProjectRoot(), baseDir);

  const sessionDir = path.join(resolvedBase, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}

/**
 * Resolves absolute directory for saving session recordings:
 * <sessionDir>/recordings
 */
export function resolveSessionRecordingsDir(sessionId: string, overrideDir?: string): string {
  const sessionDir = resolveSessionDir(sessionId, overrideDir);
  const recordingsDir = path.join(sessionDir, "recordings");
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  return recordingsDir;
}

/**
 * Resolves absolute directory for saving session writing responses:
 * <sessionDir>/writing
 */
export function resolveSessionWritingDir(sessionId: string, overrideDir?: string): string {
  const sessionDir = resolveSessionDir(sessionId, overrideDir);
  const writingDir = path.join(sessionDir, "writing");
  if (!fs.existsSync(writingDir)) {
    fs.mkdirSync(writingDir, { recursive: true });
  }
  return writingDir;
}
