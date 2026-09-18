import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "../domain/session-store.js";
import { loadConfig, getProjectRoot } from "../config/index.js";

export const GetTestSubmissionInputSchema = z.object({
  session_id: z.string().describe("The unique session ID returned by launch_speaking_test."),
  destination_folder: z
    .string()
    .optional()
    .describe("Optional directory to search in, if a custom output folder was used."),
});

export type GetTestSubmissionInput = z.infer<typeof GetTestSubmissionInputSchema>;

export async function handleGetTestSubmission(args: GetTestSubmissionInput) {
  let session = getSession(args.session_id);

  // If not found in memory, also search custom destination folder or configured audioStorageDir
  if (!session) {
    const config = loadConfig();
    const searchBase = args.destination_folder || config.audioStorageDir;
    const resolvedBase = path.isAbsolute(searchBase)
      ? searchBase
      : path.resolve(getProjectRoot(), searchBase);

    const sessionDir = path.join(resolvedBase, args.session_id);
    const metaPath = path.join(sessionDir, "session_metadata.json");

    if (fs.existsSync(metaPath)) {
      try {
        session = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (err) {
        console.error(`[GetTestSubmission] Failed parsing metadata at ${metaPath}:`, err);
      }
    }
  }

  if (!session) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Session not found: '${args.session_id}'. Ensure the ID is correct and check the audioStorageDir in toeic.config.json.`,
        },
      ],
    };
  }

  // Scan disk to verify all audio files actually exist
  const recordingsList = Object.values(session.submissions).map((sub) => {
    const existsOnDisk = fs.existsSync(sub.audioFilePath);
    const actualSize = existsOnDisk ? fs.statSync(sub.audioFilePath).size : 0;

    return {
      question_number: sub.questionNumber,
      question_type: sub.questionType,
      prompt_text: sub.promptText,
      audio_file_name: sub.audioFileName,
      audio_file_path: sub.audioFilePath,
      file_exists: existsOnDisk,
      file_size_bytes: actualSize,
      duration_seconds: sub.durationSeconds,
      uploaded_at: sub.uploadedAt,
    };
  });

  const isReady = session.status === "completed" || recordingsList.length === session.questions.length;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            session_id: session.id,
            status: session.status,
            is_ready_for_evaluation: isReady,
            total_questions: session.questions.length,
            recordings_count: recordingsList.length,
            audio_destination_folder: session.recordingsDir,
            recordings: recordingsList,
            questions_reference: session.questions,
            next_step: isReady
              ? "All voice recordings are collected on disk. You can now use the 'evaluate_speaking_test' prompt or your own evaluation rubric to assess the student's pronunciation, grammar, vocabulary, and TOEIC scaled score."
              : "Test is still in progress. The user has not finished submitting all questions yet.",
          },
          null,
          2
        ),
      },
    ],
  };
}
