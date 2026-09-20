import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LaunchSpeakingTestInputSchema,
  handleLaunchSpeakingTest,
} from "./launch-speaking-test.js";
import {
  LaunchWritingTestInputSchema,
  handleLaunchWritingTest,
} from "./launch-writing-test.js";
import {
  LaunchSpeakingAndWritingTestInputSchema,
  handleLaunchSpeakingAndWritingTest,
} from "./launch-speaking-and-writing-test.js";
import {
  GetTestSubmissionInputSchema,
  handleGetTestSubmission,
} from "./get-test-submission.js";

export function registerTools(server: McpServer): void {
  // Tool 1: launch_speaking_test
  server.tool(
    "launch_speaking_test",
    "Launches a local browser app simulating a TOEIC Speaking test with custom questions provided by the model. For picture questions (Q3-4), real internet photographs must be prioritized over raw SVGs. Saves audio recordings to the configured destination folder.",
    LaunchSpeakingTestInputSchema.shape,
    async (args) => {
      try {
        return await handleLaunchSpeakingTest(args as any);
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to launch speaking test: ${error.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 2: launch_writing_test
  server.tool(
    "launch_writing_test",
    "Launches a local browser app simulating a TOEIC Writing test with custom questions provided by the model. For picture sentence questions (Q1-5), real internet photographs must be prioritized over raw SVGs. Saves written text responses to the configured destination folder.",
    LaunchWritingTestInputSchema.shape,
    async (args) => {
      try {
        return await handleLaunchWritingTest(args as any);
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to launch writing test: ${error.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 3: launch_speaking_and_writing_test
  server.tool(
    "launch_speaking_and_writing_test",
    "Launches a local browser app simulating a combined TOEIC Speaking & Writing examination or targeted drill with custom questions provided by the model. Candidates take the Speaking section first, followed by the Writing section. Audio recordings are saved in <session_folder>/recordings/ and written responses in <session_folder>/writing/.",
    LaunchSpeakingAndWritingTestInputSchema.shape,
    async (args) => {
      try {
        return await handleLaunchSpeakingAndWritingTest(args as any);
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to launch speaking and writing test: ${error.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 4: get_test_submission
  server.tool(
    "get_test_submission",
    "Checks and retrieves the recorded audio voice samples and/or written text responses and completion status for a TOEIC Speaking, Writing, or combined Speaking & Writing test session from the configured destination folder.",
    GetTestSubmissionInputSchema.shape,
    async (args) => {
      try {
        return await handleGetTestSubmission(args as any);
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve test submission: ${error.message || String(error)}`,
            },
          ],
        };
      }
    }
  );
}

