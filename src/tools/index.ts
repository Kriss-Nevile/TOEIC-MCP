import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LaunchSpeakingTestInputSchema,
  handleLaunchSpeakingTest,
} from "./launch-speaking-test.js";
import {
  GetTestSubmissionInputSchema,
  handleGetTestSubmission,
} from "./get-test-submission.js";

export function registerTools(server: McpServer): void {
  // Tool 1: launch_speaking_test
  server.tool(
    "launch_speaking_test",
    "Launches a local browser app simulating a TOEIC Speaking test with custom questions provided by the model. Saves audio recordings to the configured destination folder.",
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

  // Tool 2: get_test_submission
  server.tool(
    "get_test_submission",
    "Checks and retrieves the recorded audio voice samples and completion status for a TOEIC Speaking test session from the configured destination folder.",
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
