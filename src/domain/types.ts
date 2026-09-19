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
  testType?: "speaking";
  title?: string;
  isDrill: boolean;
  status: SessionStatus;
  questions: SpeakingQuestion[];
  recordingsDir: string;
  submissions: Record<number, QuestionSubmission>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const WritingQuestionTypeSchema = z.enum([
  "write_sentence",   // Questions 1-5: Write a Sentence Based on a Picture
  "respond_request",  // Questions 6-7: Respond to a Written Request
  "write_opinion",    // Question 8: Write an Opinion Essay
]);

export type WritingQuestionType = z.infer<typeof WritingQuestionTypeSchema>;

export const WritingQuestionSchema = z.object({
  questionNumber: z.number().int().min(1).max(8).describe("Question number in the test (1 to 8)"),
  questionType: WritingQuestionTypeSchema.describe("TOEIC Writing part/type"),
  promptText: z.string().describe("Main instructions, scenario, or essay prompt"),
  imageUrl: z.string().optional().describe("Optional URL or base64 data URI of picture (Questions 1-5)"),
  contextData: z.string().optional().describe("Optional required keywords/phrases (Q1-5) or incoming email/memo text (Q6-7)"),
  prepTimeSeconds: z.number().int().min(0).max(300).default(0).describe("Optional preparation countdown in seconds"),
  responseTimeSeconds: z.number().int().min(10).max(3600).default(480).describe("Writing countdown in seconds (e.g. 120s for Q1-5, 600s for Q6-7, 1800s for Q8)"),
  minWords: z.number().int().min(0).optional().describe("Recommended minimum word count (e.g. 300 words for essay)"),
  evaluationFocus: z.array(z.string()).optional().describe("Key competencies to evaluate, e.g. grammar, vocabulary, organization, coherence"),
});

export type WritingQuestion = z.infer<typeof WritingQuestionSchema>;

export interface WritingQuestionSubmission {
  questionNumber: number;
  questionType: WritingQuestionType;
  promptText: string;
  writtenText: string;
  wordCount: number;
  textFileName: string;
  textFilePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  uploadedAt: string;
}

export interface WritingSession {
  id: string;
  testType: "writing";
  title?: string;
  isDrill: boolean;
  status: SessionStatus;
  questions: WritingQuestion[];
  recordingsDir: string; // Directory where text responses and metadata are saved
  submissions: Record<number, WritingQuestionSubmission>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ExamSession = SpeakingSession | WritingSession;
