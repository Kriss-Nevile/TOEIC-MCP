import { z } from "zod";
import open from "open";
import { WritingQuestionSchema } from "../domain/types.js";
import { createWritingSession } from "../domain/session-store.js";
import { startWebServer } from "../web/server.js";
import { loadConfig } from "../config/index.js";

export const LaunchWritingTestInputSchema = z.object({
  questions: z
    .array(WritingQuestionSchema)
    .min(1)
    .max(8)
    .describe(
      "Array of TOEIC Writing questions drafted by the model (1 to 8 questions). For picture-based questions (Q1-5), search the internet for authentic, decent workplace photographs first (consult resource 'toeic://guides/visual-questions'); raw inline SVGs are only allowed as a last-resort fallback when no decent online picture is found."
    ),
  selected_question_numbers: z
    .array(z.number().int().min(1).max(8))
    .optional()
    .describe("Optional subset of question numbers to test in this session (e.g. [1, 2] for Part 1 sentence writing, or [8] for opinion essay drill). If provided, only these questions will be presented in the session."),
  session_title: z
    .string()
    .optional()
    .describe("Optional custom title for the practice session or drill (e.g. 'Part 1 Drill: Picture Sentences', 'Q8 Essay Practice')."),
  part_times: z
    .object({
      part1_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Part 1 (Write a Sentence Based on a Picture). Default is 480s (8 mins) for 5 questions, or proportional."),
      part2_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Part 2 (Respond to a Written Request). Default is 1200s (20 mins) for 2 questions, or 600s per email."),
      part3_seconds: z.number().int().min(10).max(3600).optional().describe("Custom total timer in seconds for Part 3 (Write an Opinion Essay). Default is 1800s (30 mins)."),
    })
    .optional()
    .describe("Optional custom time limits in seconds for each part. If omitted, standard ETS times (Part 1: 8m, Part 2: 20m, Part 3: 30m) or calibrated proportional times are used."),
  output_directory: z
    .string()
    .optional()
    .describe("Optional custom directory path to save text responses and metadata for this session. If omitted, uses writingStorageDir from toeic.config.json (default: './writings')."),
  auto_open_browser: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to automatically open the default web browser (default: true)."),
});

export type LaunchWritingTestInput = z.infer<typeof LaunchWritingTestInputSchema>;

export async function handleLaunchWritingTest(args: LaunchWritingTestInput): Promise<{
  isError?: boolean;
  content: { type: "text"; text: string }[];
}> {
  // 1. Filter questions if selected_question_numbers is provided
  let activeQuestions = args.questions;
  if (args.selected_question_numbers && args.selected_question_numbers.length > 0) {
    activeQuestions = args.questions.filter((q) =>
      args.selected_question_numbers!.includes(q.questionNumber)
    );
    if (activeQuestions.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `None of the provided questions matched selected_question_numbers: [${args.selected_question_numbers.join(", ")}]. Available question numbers: [${args.questions.map((q) => q.questionNumber).join(", ")}]`,
          },
        ],
      };
    }
  }

  const config = loadConfig();

  // 2. Ensure the web server is running
  const { port } = await startWebServer(config.webServerPort);

  // 3. Create the writing session in store & prepare directory with ETS part structure
  const session = createWritingSession(
    activeQuestions,
    args.output_directory,
    args.session_title,
    args.part_times
  );

  // 4. Construct local test URL
  const testUrl = `http://localhost:${port}/index.html?session=${session.id}`;

  // 5. Optionally launch the browser
  const shouldOpen = args.auto_open_browser ?? config.autoOpenBrowser ?? true;
  let browserOpened = false;

  if (shouldOpen) {
    try {
      await open(testUrl);
      browserOpened = true;
    } catch (err) {
      console.error("[LaunchWritingTest] Failed to auto-open browser:", err);
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
            test_type: "writing",
            mode: session.isDrill ? "targeted_drill" : "full_mock_test",
            web_url: testUrl,
            browser_auto_opened: browserOpened,
            destination_folder: session.storageDir || session.recordingsDir,
            questions_count: session.questions.length,
            practiced_questions: session.questions.map((q) => q.questionNumber),
            parts_breakdown: session.parts?.map((p) => ({
              part_number: p.partNumber,
              title: p.title,
              allocated_time_seconds: p.timeSeconds,
              allocated_time_formatted: `${Math.floor(p.timeSeconds / 60)}m${p.timeSeconds % 60 ? ` ${p.timeSeconds % 60}s` : ""}`,
              questions_count: p.questions.length,
              question_numbers: p.questions.map((q) => q.questionNumber),
            })),
            message: session.isDrill
              ? `Targeted writing drill launched for question(s): ${session.questions.map((q) => `Q${q.questionNumber}`).join(", ")}. Complete writing responses in the browser, then call 'get_test_submission' with this session_id to evaluate.`
              : "Full TOEIC Writing simulator launched. Complete the test in the browser, then call 'get_test_submission' to evaluate.",
          },
          null,
          2
        ),
      },
    ],
  };
}
