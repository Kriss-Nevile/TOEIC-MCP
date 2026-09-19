import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  EvaluateSpeakingPromptArgsSchema,
  buildEvaluateSpeakingPrompt,
} from "./evaluate-speaking.js";
import {
  EvaluateWritingPromptArgsSchema,
  buildEvaluateWritingPrompt,
} from "./evaluate-writing.js";
import {
  EvaluateQuestionPromptArgsSchema,
  buildEvaluateQuestionPrompt,
} from "./evaluate-question.js";
import {
  DiagnoseWeaknessesPromptArgsSchema,
  buildDiagnoseWeaknessesPrompt,
} from "./diagnose-weaknesses.js";
import {
  GenerateTargetedLessonPromptArgsSchema,
  buildGenerateTargetedLessonPrompt,
} from "./generate-targeted-lesson.js";

export function registerPrompts(server: McpServer): void {
  // Prompt 1: evaluate_speaking_test
  server.prompt(
    "evaluate_speaking_test",
    "Generates an expert evaluation prompt for assessing candidate voice recordings against official ETS TOEIC Speaking rubrics.",
    EvaluateSpeakingPromptArgsSchema,
    async (args) => {
      return buildEvaluateSpeakingPrompt(args as any);
    }
  );

  // Prompt 2: evaluate_writing_test
  server.prompt(
    "evaluate_writing_test",
    "Generates an expert evaluation prompt for assessing candidate written responses against official ETS TOEIC Writing rubrics.",
    EvaluateWritingPromptArgsSchema,
    async (args) => {
      return buildEvaluateWritingPrompt(args as any);
    }
  );

  // Prompt 2: evaluate_question
  server.prompt(
    "evaluate_question",
    "Performs deep distractor analysis, trap classification, and actionable remediation for a specific TOEIC Listening or Reading question.",
    EvaluateQuestionPromptArgsSchema,
    async (args) => {
      return buildEvaluateQuestionPrompt(args as any);
    }
  );

  // Prompt 3: diagnose_weaknesses
  server.prompt(
    "diagnose_weaknesses",
    "Synthesizes test session results into a comprehensive diagnostic breakdown by Part, error type, and personalized study roadmap.",
    DiagnoseWeaknessesPromptArgsSchema,
    async (args) => {
      return buildDiagnoseWeaknessesPrompt(args as any);
    }
  );

  // Prompt 4: generate_targeted_lesson
  server.prompt(
    "generate_targeted_lesson",
    "Produces a focused mini-lesson and customized exercise drill set based on a specific grammar topic or error pattern.",
    GenerateTargetedLessonPromptArgsSchema,
    async (args) => {
      return buildGenerateTargetedLessonPrompt(args as any);
    }
  );
}
