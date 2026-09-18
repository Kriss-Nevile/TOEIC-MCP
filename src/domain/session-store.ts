import fs from "node:fs";
import path from "node:path";
import { SpeakingSession, SpeakingQuestion, QuestionSubmission, SessionStatus } from "./types.js";
import { resolveSessionRecordingsDir, loadConfig, getProjectRoot } from "../config/index.js";

const METADATA_FILE_NAME = "session_metadata.json";

// In-memory session cache for fast lookups
const sessions = new Map<string, SpeakingSession>();

export function createSession(
  questions: SpeakingQuestion[],
  overrideAudioDir?: string,
  title?: string
): SpeakingSession {
  const id = `spk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const recordingsDir = resolveSessionRecordingsDir(id, overrideAudioDir);
  const isDrill = questions.length < 11;
  const defaultTitle = isDrill
    ? `Targeted Drill (${questions.length} Question${questions.length > 1 ? "s" : ""})`
    : "Full Speaking Mock Test (11 Questions)";

  const session: SpeakingSession = {
    id,
    title: title || defaultTitle,
    isDrill,
    status: "pending",
    questions,
    recordingsDir,
    submissions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  persistSessionMetadata(session);
  return session;
}

export function getSession(id: string): SpeakingSession | null {
  if (sessions.has(id)) {
    return sessions.get(id)!;
  }

  // Try locating on disk in configured audioStorageDir
  const diskSession = findSessionOnDisk(id);
  if (diskSession) {
    sessions.set(id, diskSession);
    return diskSession;
  }

  return null;
}

export function updateSessionStatus(id: string, status: SessionStatus): SpeakingSession | null {
  const session = getSession(id);
  if (!session) return null;

  session.status = status;
  session.updatedAt = new Date().toISOString();
  if (status === "completed") {
    session.completedAt = new Date().toISOString();
  }

  sessions.set(id, session);
  persistSessionMetadata(session);
  return session;
}

export function recordSubmission(
  sessionId: string,
  submission: QuestionSubmission
): SpeakingSession | null {
  const session = getSession(sessionId);
  if (!session) return null;

  session.status = "in_progress";
  session.submissions[submission.questionNumber] = submission;
  session.updatedAt = new Date().toISOString();

  sessions.set(sessionId, session);
  persistSessionMetadata(session);
  return session;
}

export function persistSessionMetadata(session: SpeakingSession): void {
  try {
    const metaPath = path.join(session.recordingsDir, METADATA_FILE_NAME);
    fs.writeFileSync(metaPath, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.error(`[SessionStore] Error writing session metadata for ${session.id}:`, err);
  }
}

export function findSessionOnDisk(id: string): SpeakingSession | null {
  const config = loadConfig();
  const baseDir = path.isAbsolute(config.audioStorageDir)
    ? config.audioStorageDir
    : path.resolve(getProjectRoot(), config.audioStorageDir);

  const sessionDir = path.join(baseDir, id);
  const metaPath = path.join(sessionDir, METADATA_FILE_NAME);

  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, "utf-8");
      return JSON.parse(raw) as SpeakingSession;
    } catch (err) {
      console.error(`[SessionStore] Failed to read disk metadata at ${metaPath}:`, err);
    }
  }

  return null;
}

export function getAllSessions(): SpeakingSession[] {
  return Array.from(sessions.values());
}
