import { z } from "zod";
import open from "open";
import { SpeakingQuestionSchema, WritingQuestionSchema } from "../domain/types.js";
import { createSpeakingAndWritingSession } from "../domain/session-store.js";
import { startWebServer } from "../web/server.js";
import { loadConfig } from "../config/index.js";

export const LaunchSpeakingAndWritingTestInputSchema = z.object({
  speaking_questions: z
    .array(SpeakingQuestionSchema)
    .min(1)
    .max(11)
    .describe(
      "Array of TOEIC Speaking questions drafted by the model (1 to 11 questions). For picture-based questions (Q3-4), search the internet for authentic workplace photographs first (consult resource 'toeic://guides/visual-questions')."
    ),
  writing_questions: z
    .array(WritingQuestionSchema)
    .min(1)
    .max(8)
    .describe(
      "Array of TOEIC Writing questions drafted by the model (1 to 8 questions). For picture-based questions (Q1-5), search the internet for authentic workplace photographs first (consult resource 'toeic://guides/visual-questions')."
    ),
  selected_speaking_question_numbers: z
    .array(z.number().int().min(1).max(11))
    .optional()
    .describe("Optional subset of speaking question numbers to test (e.g. [1, 2] or [3]). If omitted, all speaking questions are presented."),
  selected_writing_question_numbers: z
    .array(z.number().int().min(1).max(8))
    .optional()
    .describe("Optional subset of writing question numbers to test (e.g. [1, 2] or [8]). If omitted, all writing questions are presented."),
  session_title: z
    .string()
    .optional()
    .describe("Optional custom title for the combined session (e.g. 'Complete Speaking & Writing Mock Test 1')."),
  part_times: z
    .object({
      part1_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Writing Part 1. Default is 480s (8 mins)."),
      part2_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Writing Part 2. Default is 1200s (20 mins)."),
      part3_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Writing Part 3. Default is 1800s (30 mins)."),
    })
    .optional()
    .describe("Optional custom time limits in seconds for each writing part."),
  output_directory: z
    .string()
    .optional()
    .describe("Optional custom directory path to save session files (defaults to sessionStorageDir in toeic.config.json: './sessions')."),
  auto_open_browser: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to automatically open the default web browser (default: true)."),
});

export type LaunchSpeakingAndWritingTestInput = z.infer<typeof LaunchSpeakingAndWritingTestInputSchema>;

export async function handleLaunchSpeakingAndWritingTest(args: LaunchSpeakingAndWritingTestInput): Promise<{
  isError?: boolean;
  content: { type: "text"; text: string }[];
}> {
  // 1. Filter speaking questions if specified
  let activeSpeaking = args.speaking_questions;
  if (args.selected_speaking_question_numbers && args.selected_speaking_question_numbers.length > 0) {
    activeSpeaking = args.speaking_questions.filter((q) =>
      args.selected_speaking_question_numbers!.includes(q.questionNumber)
    );
    if (activeSpeaking.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `None of the provided speaking questions matched selected_speaking_question_numbers: [${args.selected_speaking_question_numbers.join(", ")}]. Available: [${args.speaking_questions.map((q) => q.questionNumber).join(", ")}]`,
          },
        ],
      };
    }
  }

  // 2. Filter writing questions if specified
  let activeWriting = args.writing_questions;
  if (args.selected_writing_question_numbers && args.selected_writing_question_numbers.length > 0) {
    activeWriting = args.writing_questions.filter((q) =>
      args.selected_writing_question_numbers!.includes(q.questionNumber)
    );
    if (activeWriting.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `None of the provided writing questions matched selected_writing_question_numbers: [${args.selected_writing_question_numbers.join(", ")}]. Available: [${args.writing_questions.map((q) => q.questionNumber).join(", ")}]`,
          },
        ],
      };
    }
  }

  const config = loadConfig();

  // 3. Ensure the web server is running
  const { port } = await startWebServer(config.webServerPort);

  // 4. Create the combined session
  const session = createSpeakingAndWritingSession(
    activeSpeaking,
    activeWriting,
    args.output_directory,
    args.session_title,
    args.part_times
  );

  // 5. Construct local test URL
  const testUrl = `http://localhost:${port}/index.html?session=${session.id}`;

  // 6. Optionally launch the browser
  const shouldOpen = args.auto_open_browser ?? config.autoOpenBrowser ?? true;
  let browserOpened = false;

  if (shouldOpen) {
    try {
      await open(testUrl);
      browserOpened = true;
    } catch (err) {
      console.error("[LaunchSpeakingAndWritingTest] Failed to auto-open browser:", err);
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            status: "launched",
            session_id: session.id,
            session_title: session.title,
            test_type: "speaking_and_writing",
            mode: session.isDrill ? "targeted_drill" : "full_mock_test",
            web_url: testUrl,
            browser_auto_opened: browserOpened,
            session_folder: session.sessionDir,
            recordings_folder: session.recordingsDir,
            writing_folder: session.writingDir,
            speaking_questions_count: activeSpeaking.length,
            speaking_questions: activeSpeaking.map((q) => q.questionNumber),
            writing_questions_count: activeWriting.length,
            writing_questions: activeWriting.map((q) => q.questionNumber),
            parts_breakdown: session.parts?.map((p) => ({
              part_number: p.partNumber,
              title: p.title,
              allocated_time_seconds: p.timeSeconds,
              allocated_time_formatted: `${Math.floor(p.timeSeconds / 60)}m${p.timeSeconds % 60 ? ` ${p.timeSeconds % 60}s` : ""}`,
              questions_count: p.questions.length,
              question_numbers: p.questions.map((q) => q.questionNumber),
            })),
            message: `TOEIC Speaking & Writing session launched! Candidate will take the Speaking section first, then proceed to the Writing section. Once completed, call 'get_test_submission' with session_id '${session.id}' to retrieve all recordings and written essays.`,
          },
          null,
          2
        ),
      },
    ],
  };
}
