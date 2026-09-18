import fs from "node:fs";
import path from "node:path";

export interface ToeicConfig {
  audioStorageDir: string;
  webServerPort: number;
  autoOpenBrowser: boolean;
  httpTransportPort: number;
}

const DEFAULT_CONFIG: ToeicConfig = {
  audioStorageDir: "./recordings",
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
        audioStorageDir: parsed.audioStorageDir || DEFAULT_CONFIG.audioStorageDir,
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
 * Resolves absolute directory for saving session recordings.
 * If overrideDir is provided, that takes precedence.
 * Otherwise uses configured audioStorageDir.
 */
export function resolveSessionRecordingsDir(sessionId: string, overrideDir?: string): string {
  const baseDir = overrideDir || loadConfig().audioStorageDir;
  const resolvedBase = path.isAbsolute(baseDir)
    ? baseDir
    : path.resolve(getProjectRoot(), baseDir);
  
  const sessionDir = path.join(resolvedBase, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}
