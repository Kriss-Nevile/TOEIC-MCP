import fs from "node:fs";
import path from "node:path";
import {
  SpeakingSession,
  SpeakingQuestion,
  QuestionSubmission,
  WritingSession,
  WritingQuestion,
  WritingExamPart,
  WritingQuestionSubmission,
  SpeakingAndWritingSession,
  ExamSession,
  SessionStatus,
} from "./types.js";
import {
  resolveSessionDir,
  resolveSessionRecordingsDir,
  resolveSessionWritingDir,
  loadConfig,
  getProjectRoot,
} from "../config/index.js";

const METADATA_FILE_NAME = "session_metadata.json";

// In-memory session cache for fast lookups
const sessions = new Map<string, ExamSession>();

export function createSession(
  questions: SpeakingQuestion[],
  overrideStorageDir?: string,
  title?: string
): SpeakingSession {
  const id = `spk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionDir = resolveSessionDir(id, overrideStorageDir);
  const recordingsDir = resolveSessionRecordingsDir(id, overrideStorageDir);
  const isDrill = questions.length < 11;
  const defaultTitle = isDrill
    ? `Targeted Speaking Drill (${questions.length} Question${questions.length > 1 ? "s" : ""})`
    : "Full Speaking Mock Test (11 Questions)";

  const session: SpeakingSession = {
    id,
    testType: "speaking",
    title: title || defaultTitle,
    isDrill,
    status: "pending",
    questions,
    sessionDir,
    recordingsDir,
    submissions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  persistSessionMetadata(session);
  return session;
}

export function buildWritingParts(
  questions: WritingQuestion[],
  customPartTimes?: { part1_seconds?: number; part2_seconds?: number; part3_seconds?: number }
): WritingExamPart[] {
  const parts: WritingExamPart[] = [];

  // Part 1: Write a Sentence Based on a Picture (write_sentence)
  const part1Questions = questions.filter((q) => q.questionType === "write_sentence");
  if (part1Questions.length > 0) {
    const part1Time =
      customPartTimes?.part1_seconds ??
      (part1Questions.length >= 5 ? 480 : Math.max(120, Math.round(part1Questions.length * 96)));

    parts.push({
      partNumber: 1,
      partType: "write_sentence",
      title: "Part 1: Write a Sentence Based on a Picture",
      taskDescription: "Write a sentence based on a picture",
      directions: [
        "You will see a picture along with two words or phrases that must be used in your sentence.",
        "You may change the form of the words and arrange them in any order to create a complete sentence.",
      ],
      timeSeconds: part1Time,
      questions: part1Questions,
    });
  }

  // Part 2: Respond to a Written Request (respond_request)
  const part2Questions = questions.filter((q) => q.questionType === "respond_request");
  if (part2Questions.length > 0) {
    const part2Time =
      customPartTimes?.part2_seconds ??
      (part2Questions.length * 600); // 10 minutes (600s) per email

    parts.push({
      partNumber: 2,
      partType: "respond_request",
      title: "Part 2: Respond to a Written Request",
      taskDescription: "Respond to a written request",
      directions: [
        "This part assesses your ability to respond to written requests in an email format.",
        "You have 10 minutes to read and write a response to each email.",
      ],
      timeSeconds: part2Time,
      questions: part2Questions,
    });
  }

  // Part 3: Write an Opinion Essay (write_opinion)
  const part3Questions = questions.filter((q) => q.questionType === "write_opinion");
  if (part3Questions.length > 0) {
    const part3Time =
      customPartTimes?.part3_seconds ??
      (part3Questions.length * 1800); // 30 minutes (1800s) per essay

    parts.push({
      partNumber: 3,
      partType: "write_opinion",
      title: "Part 3: Write an Opinion Essay",
      taskDescription: "Write an opinion essay",
      directions: [
        "Write an essay expressing your opinion on a specific topic.",
        "Your essay should present well-developed arguments, clear explanations, and relevant examples to support your opinion.",
        "An effective essay is typically at least 300 words long.",
      ],
      timeSeconds: part3Time,
      questions: part3Questions,
    });
  }

  return parts;
}

export function createWritingSession(
  questions: WritingQuestion[],
  overrideStorageDir?: string,
  title?: string,
  customPartTimes?: { part1_seconds?: number; part2_seconds?: number; part3_seconds?: number }
): WritingSession {
  const id = `wrt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionDir = resolveSessionDir(id, overrideStorageDir);
  const writingDir = resolveSessionWritingDir(id, overrideStorageDir);
  const isDrill = questions.length < 8;
  const parts = buildWritingParts(questions, customPartTimes);

  let defaultTitle: string;
  if (isDrill) {
    const partsLabel = parts.map((p) => `Part ${p.partNumber}`).join(", ");
    defaultTitle = `Targeted Writing Drill (${partsLabel}: ${questions.length} Question${questions.length > 1 ? "s" : ""})`;
  } else {
    defaultTitle = "Full Writing Mock Test (8 Questions)";
  }

  const session: WritingSession = {
    id,
    testType: "writing",
    title: title || defaultTitle,
    isDrill,
    status: "pending",
    questions,
    parts,
    sessionDir,
    writingDir,
    storageDir: sessionDir,
    recordingsDir: sessionDir, // Backwards-compatibility alias
    submissions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  persistSessionMetadata(session);
  return session;
}

export function createSpeakingAndWritingSession(
  speakingQuestions: SpeakingQuestion[],
  writingQuestions: WritingQuestion[],
  overrideStorageDir?: string,
  title?: string,
  customPartTimes?: { part1_seconds?: number; part2_seconds?: number; part3_seconds?: number }
): SpeakingAndWritingSession {
  const id = `toeic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionDir = resolveSessionDir(id, overrideStorageDir);
  const recordingsDir = resolveSessionRecordingsDir(id, overrideStorageDir);
  const writingDir = resolveSessionWritingDir(id, overrideStorageDir);
  const isDrill = speakingQuestions.length < 11 || writingQuestions.length < 8;
  const parts = buildWritingParts(writingQuestions, customPartTimes);

  const defaultTitle = isDrill
    ? `Targeted Speaking & Writing Drill (${speakingQuestions.length} Speaking, ${writingQuestions.length} Writing)`
    : "Full TOEIC Speaking & Writing Mock Test";

  const session: SpeakingAndWritingSession = {
    id,
    testType: "speaking_and_writing",
    title: title || defaultTitle,
    isDrill,
    status: "pending",
    questions: [...speakingQuestions, ...writingQuestions],
    speakingQuestions,
    writingQuestions,
    writingParts: parts,
    parts,
    sessionDir,
    recordingsDir,
    writingDir,
    storageDir: sessionDir,
    submissions: {},
    writingSubmissions: {},
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

  // Try locating on disk in configured sessionStorageDir or legacy dirs
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
): ExamSession | null {
  const session = getSession(sessionId);
  if (!session) return null;

  session.status = "in_progress";
  (session as any).submissions = (session as any).submissions || {};
  (session as any).submissions[submission.questionNumber] = submission;
  session.updatedAt = new Date().toISOString();

  sessions.set(sessionId, session);
  persistSessionMetadata(session);
  return session;
}

export function recordWritingSubmission(
  sessionId: string,
  submission: WritingQuestionSubmission
): ExamSession | null {
  const session = getSession(sessionId);
  if (!session) return null;

  session.status = "in_progress";

  const writingDir =
    (session as any).writingDir ||
    path.join((session as any).sessionDir || (session as any).storageDir || session.recordingsDir, "writing");

  if (!fs.existsSync(writingDir)) {
    fs.mkdirSync(writingDir, { recursive: true });
  }

  // Ensure written text file is saved on disk
  if (submission.textFilePath && submission.writtenText) {
    try {
      fs.writeFileSync(submission.textFilePath, submission.writtenText, "utf-8");
    } catch (err) {
      console.error(`[SessionStore] Failed writing text file ${submission.textFilePath}:`, err);
    }
  }

  if (session.testType === "speaking_and_writing") {
    const swSession = session as SpeakingAndWritingSession;
    swSession.writingSubmissions = swSession.writingSubmissions || {};
    swSession.writingSubmissions[submission.questionNumber] = submission;
  } else {
    const wrtSession = session as WritingSession;
    wrtSession.submissions[submission.questionNumber] = submission;
  }

  session.updatedAt = new Date().toISOString();

  sessions.set(sessionId, session);
  persistSessionMetadata(session);
  return session;
}

export function persistSessionMetadata(session: ExamSession): void {
  try {
    const sessionDir =
      session.sessionDir ||
      (session as any).storageDir ||
      session.recordingsDir;

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const metaPath = path.join(sessionDir, METADATA_FILE_NAME);
    fs.writeFileSync(metaPath, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.error(`[SessionStore] Error writing session metadata for ${session.id}:`, err);
  }
}

export function findSessionOnDisk(id: string): ExamSession | null {
  const config = loadConfig();
  const searchDirs = [
    config.sessionStorageDir || "./sessions",
    config.writingStorageDir,
    config.audioStorageDir,
  ].filter(Boolean) as string[];

  for (const rawDir of searchDirs) {
    const baseDir = path.isAbsolute(rawDir)
      ? rawDir
      : path.resolve(getProjectRoot(), rawDir);

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
  }

  return null;
}

export function getAllSessions(): ExamSession[] {
  return Array.from(sessions.values());
}
