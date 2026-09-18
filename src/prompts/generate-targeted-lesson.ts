import { z } from "zod";

export const GenerateTargetedLessonPromptArgsSchema = {
  topic: z
    .string()
    .describe("Specific grammar, vocabulary, or exam skill area (e.g. 'Gerunds vs Infinitives', 'Part 2 Indirect Answers', 'Part 7 Invoices & Purchase Orders')"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional()
    .describe("Difficulty scaling for the lesson content and practice exercises"),
  target_part: z
    .string()
    .optional()
    .describe("Target TOEIC Part (e.g., 'Part 2', 'Part 5', 'Part 7', 'Speaking')"),
};

export function buildGenerateTargetedLessonPrompt(args: {
  topic: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  target_part?: string;
}) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are an expert TOEIC Curriculum Designer and Master Instructor.
Create a highly focused, authentic mini-lesson and drill set for the following targeted topic:

- **Target Topic**: ${args.topic}
- **Target Part**: ${args.target_part || "Applicable TOEIC Sections"}
- **Difficulty Level**: ${args.difficulty || "intermediate"}

---

### Lesson Structure Required:

1. **Core Concept & Exam Principle (3–5 minutes reading)**:
   - Clear, concise explanation of the grammatical rule, vocabulary pattern, or comprehension strategy.
   - Explain how ETS tests this concept and where examinees commonly lose points.

2. **The "Trap Breakdown" (ETS Distractor Blueprints)**:
   - Identify the 2–3 most deceptive traps test writers set for this topic (e.g. deceptive sound-alikes, conflicting tenses, false logic).
   - Provide "Before vs. After" contrast examples showing how to avoid each trap.

3. **Authentic Practice Drill (3 Exam-Style Questions)**:
   - Generate 3 realistic TOEIC test items matching authentic ETS standards (business context, formal register, realistic corporate names).
   - Format:
     - Question Item
     - 4 Options (A, B, C, D) or 3 options for Part 2
   
4. **Answer Key & Detailed Pedagogical Commentary**:
   - Correct Option for each question.
   - Breakdown of why the correct choice works.
   - Elimination logic explaining why each distractor is incorrect.

5. **Flashcard / Memory Anchor**:
   - A single high-retention rule, rhyme, or mnemonic to remember under exam time pressure.`,
        },
      },
    ],
  };
}
