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
    .describe("Array of TOEIC Speaking questions drafted by the model (1 to 11 questions)."),
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

export async function handleLaunchSpeakingTest(args: LaunchSpeakingTestInput) {
  const config = loadConfig();

  // 1. Ensure the web server is running
  const { port } = await startWebServer(config.webServerPort);

  // 2. Create the test session in store & prepare audio directory
  const session = createSession(args.questions, args.output_directory);

  // 3. Construct local test URL
  const testUrl = `http://localhost:${port}/index.html?session=${session.id}`;

  // 4. Optionally launch the browser
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
            web_url: testUrl,
            browser_auto_opened: browserOpened,
            audio_destination_folder: session.recordingsDir,
            questions_count: session.questions.length,
            message:
              "Local TOEIC Speaking simulator launched. The user is now taking the exam in their browser. Once the user finishes and submits, call the 'get_test_submission' tool with this session_id to retrieve the audio recordings for evaluation.",
          },
          null,
          2
        ),
      },
    ],
  };
}
