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
    .describe("Array of TOEIC Writing questions drafted by the model (1 to 8 questions)."),
  selected_question_numbers: z
    .array(z.number().int().min(1).max(8))
    .optional()
    .describe("Optional subset of question numbers to test in this session (e.g. [1, 2] for Part 1 sentence writing, or [8] for opinion essay drill). If provided, only these questions will be presented in the session."),
  session_title: z
    .string()
    .optional()
    .describe("Optional custom title for the practice session or drill (e.g. 'Part 1 Drill: Picture Sentences', 'Q8 Essay Practice')."),
  output_directory: z
    .string()
    .optional()
    .describe("Optional custom directory path to save text responses and metadata for this session. If omitted, uses audioStorageDir from toeic.config.json."),
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

  // 3. Create the writing session in store & prepare directory
  const session = createWritingSession(activeQuestions, args.output_directory, args.session_title);

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
            destination_folder: session.recordingsDir,
            questions_count: session.questions.length,
            practiced_questions: session.questions.map((q) => q.questionNumber),
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
