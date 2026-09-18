import { z } from "zod";

export const QuestionTypeSchema = z.enum([
  "read_aloud",           // Questions 1-2
  "describe_picture",     // Questions 3-4
  "respond_to_questions", // Questions 5-7
  "respond_with_info",    // Questions 8-10
  "express_opinion"       // Question 11
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const SpeakingQuestionSchema = z.object({
  questionNumber: z.number().int().min(1).max(11).describe("Question number in the test (1 to 11)"),
  questionType: QuestionTypeSchema.describe("TOEIC Speaking part/type"),
  promptText: z.string().describe("Main text prompt, instructions, or reading passage"),
  imageUrl: z.string().optional().describe("Optional URL or base64 data URI of picture (Q3-4) or schedule diagram"),
  contextData: z.string().optional().describe("Optional schedule, itinerary, agenda, or background text (especially Q8-10)"),
  prepTimeSeconds: z.number().int().min(0).max(120).default(45).describe("Preparation countdown in seconds"),
  responseTimeSeconds: z.number().int().min(5).max(120).default(45).describe("Speaking response recording countdown in seconds"),
  evaluationFocus: z.array(z.string()).optional().describe("Key competencies to evaluate, e.g. pronunciation, vocabulary, grammar"),
});

export type SpeakingQuestion = z.infer<typeof SpeakingQuestionSchema>;

export interface QuestionSubmission {
  questionNumber: number;
  questionType: QuestionType;
  promptText: string;
  audioFileName: string;
  audioFilePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  uploadedAt: string;
}

export type SessionStatus = "pending" | "in_progress" | "completed" | "abandoned";

export interface SpeakingSession {
  id: string;
  status: SessionStatus;
  questions: SpeakingQuestion[];
  recordingsDir: string;
  submissions: Record<number, QuestionSubmission>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
