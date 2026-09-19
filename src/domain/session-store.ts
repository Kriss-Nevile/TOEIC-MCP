import fs from "node:fs";
import path from "node:path";
import {
  SpeakingSession,
  SpeakingQuestion,
  QuestionSubmission,
  WritingSession,
  WritingQuestion,
  WritingQuestionSubmission,
  ExamSession,
  SessionStatus,
} from "./types.js";
import { resolveSessionRecordingsDir, loadConfig, getProjectRoot } from "../config/index.js";

const METADATA_FILE_NAME = "session_metadata.json";

// In-memory session cache for fast lookups
const sessions = new Map<string, ExamSession>();

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
    testType: "speaking",
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

export function createWritingSession(
  questions: WritingQuestion[],
  overrideStorageDir?: string,
  title?: string
): WritingSession {
  const id = `wrt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const recordingsDir = resolveSessionRecordingsDir(id, overrideStorageDir);
  const isDrill = questions.length < 8;
  const defaultTitle = isDrill
    ? `Targeted Writing Drill (${questions.length} Question${questions.length > 1 ? "s" : ""})`
    : "Full Writing Mock Test (8 Questions)";

  const session: WritingSession = {
    id,
    testType: "writing",
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

export function getSession(id: string): ExamSession | null {
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

export function updateSessionStatus(id: string, status: SessionStatus): ExamSession | null {
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
  if (!session || session.id.startsWith("wrt_")) return null;

  const spkSession = session as SpeakingSession;
  spkSession.status = "in_progress";
  spkSession.submissions[submission.questionNumber] = submission;
  spkSession.updatedAt = new Date().toISOString();

  sessions.set(sessionId, spkSession);
  persistSessionMetadata(spkSession);
  return spkSession;
}

export function recordWritingSubmission(
  sessionId: string,
  submission: WritingQuestionSubmission
): WritingSession | null {
  const session = getSession(sessionId);
  if (!session || !session.id.startsWith("wrt_")) return null;

  const wrtSession = session as WritingSession;
  wrtSession.status = "in_progress";

  if (!fs.existsSync(wrtSession.recordingsDir)) {
    fs.mkdirSync(wrtSession.recordingsDir, { recursive: true });
  }

  // Ensure written text file is saved on disk
  if (submission.textFilePath && submission.writtenText) {
    try {
      fs.writeFileSync(submission.textFilePath, submission.writtenText, "utf-8");
    } catch (err) {
      console.error(`[SessionStore] Failed writing text file ${submission.textFilePath}:`, err);
    }
  }

  wrtSession.submissions[submission.questionNumber] = submission;
  wrtSession.updatedAt = new Date().toISOString();

  sessions.set(sessionId, wrtSession);
  persistSessionMetadata(wrtSession);
  return wrtSession;
}

export function persistSessionMetadata(session: ExamSession): void {
  try {
    if (!fs.existsSync(session.recordingsDir)) {
      fs.mkdirSync(session.recordingsDir, { recursive: true });
    }
    const metaPath = path.join(session.recordingsDir, METADATA_FILE_NAME);
    fs.writeFileSync(metaPath, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.error(`[SessionStore] Error writing session metadata for ${session.id}:`, err);
  }
}

export function findSessionOnDisk(id: string): ExamSession | null {
  const config = loadConfig();
  const baseDir = path.isAbsolute(config.audioStorageDir)
    ? config.audioStorageDir
    : path.resolve(getProjectRoot(), config.audioStorageDir);

  const sessionDir = path.join(baseDir, id);
  const metaPath = path.join(sessionDir, METADATA_FILE_NAME);

  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, "utf-8");
      return JSON.parse(raw) as ExamSession;
    } catch (err) {
      console.error(`[SessionStore] Failed to read disk metadata at ${metaPath}:`, err);
    }
  }

  return null;
}

export function getAllSessions(): ExamSession[] {
  return Array.from(sessions.values());
}

