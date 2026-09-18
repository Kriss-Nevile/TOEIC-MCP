import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  EvaluateSpeakingPromptArgsSchema,
  buildEvaluateSpeakingPrompt,
} from "./evaluate-speaking.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "evaluate_speaking_test",
    "Generates an expert evaluation prompt for assessing candidate voice recordings against official ETS TOEIC Speaking rubrics.",
    EvaluateSpeakingPromptArgsSchema,
    async (args) => {
      return buildEvaluateSpeakingPrompt(args as any);
    }
  );
}
