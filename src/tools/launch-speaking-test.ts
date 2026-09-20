import { z } from "zod";
import open from "open";
import { SpeakingQuestionSchema } from "../domain/types.js";
import { createSession } from "../domain/session-store.js";
import { startWebServer } from "../web/server.js";
import { loadConfig } from "../config/index.js";

export const LaunchSpeakingTestInputSchema = z.object({
  questions: z
    .array(SpeakingQuestionSchema)
    .min(1)
    .max(11)
    .describe(
      "Array of TOEIC Speaking questions drafted by the model (1 to 11 questions). For picture-based questions (Q3-4), search the internet for authentic, decent workplace photographs first (consult resource 'toeic://guides/visual-questions'); raw inline SVGs are only allowed as a last-resort fallback when no decent online picture is found."
    ),
  selected_question_numbers: z
    .array(z.number().int().min(1).max(11))
    .optional()
    .describe("Optional subset of question numbers to test in this session (e.g. [1, 2] for Part 1 read aloud, or [3] for photo description). If provided, only these questions will be presented in the session."),
  session_title: z
    .string()
    .optional()
    .describe("Optional custom title for the practice session or drill (e.g. 'Part 2 Drill: Describe a Picture', 'Q11 Opinion Practice')."),
  output_directory: z
    .string()
    .optional()
    .describe("Optional custom directory path to save audio recordings for this session. If omitted, uses audioStorageDir from toeic.config.json."),
  auto_open_browser: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to automatically open the default web browser (default: true)."),
});

export type LaunchSpeakingTestInput = z.infer<typeof LaunchSpeakingTestInputSchema>;

export async function handleLaunchSpeakingTest(args: LaunchSpeakingTestInput): Promise<{
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

  // 3. Create the test session in store & prepare audio directory
  const session = createSession(activeQuestions, args.output_directory, args.session_title);

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
      console.error("[LaunchSpeakingTest] Failed to auto-open browser:", err);
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
            mode: session.isDrill ? "targeted_drill" : "full_mock_test",
            web_url: testUrl,
            browser_auto_opened: browserOpened,
            audio_destination_folder: session.recordingsDir,
            questions_count: session.questions.length,
            practiced_questions: session.questions.map((q) => q.questionNumber),
            message: session.isDrill
              ? `Targeted speaking drill launched for question(s): ${session.questions.map((q) => `Q${q.questionNumber}`).join(", ")}. Complete recording in the browser, then call 'get_test_submission' with this session_id to evaluate.`
              : "Full TOEIC Speaking simulator launched. Complete the test in the browser, then call 'get_test_submission' to evaluate.",
          },
          null,
          2
        ),
      },
    ],
  };
}
