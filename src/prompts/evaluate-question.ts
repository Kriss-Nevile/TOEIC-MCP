import { z } from "zod";

export const EvaluateQuestionPromptArgsSchema = {
  part: z.string().describe("TOEIC Part number (e.g., '1', '2', '5', '6', '7')"),
  question_text: z.string().describe("The question stem or incomplete sentence"),
  options: z.string().describe("The multiple choice options (e.g., 'A: ... B: ... C: ... D: ...')"),
  candidate_answer: z.string().describe("The option chosen by the candidate (e.g., 'A', 'B', 'C', 'D')"),
  correct_answer: z.string().describe("The official correct option key (e.g., 'A', 'B', 'C', 'D')"),
  context_or_transcript: z
    .string()
    .optional()
    .describe("Optional reading passage text, memo, email, or listening audio transcript"),
};

export function buildEvaluateQuestionPrompt(args: {
  part: string;
  question_text: string;
  options: string;
  candidate_answer: string;
  correct_answer: string;
  context_or_transcript?: string;
}) {
  const isCorrect = args.candidate_answer.trim().toUpperCase() === args.correct_answer.trim().toUpperCase();

  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are an elite TOEIC (Listening & Reading) Master Instructor and ETS Rubric Evaluator.
Analyze and evaluate the candidate's response to the following TOEIC Part ${args.part} item:

### Question Item:
- **Part**: Part ${args.part}
${args.context_or_transcript ? `- **Context / Reading Passage / Audio Transcript**:\n"""\n${args.context_or_transcript}\n"""\n` : ""}- **Question Stem**: ${args.question_text}
- **Choices**: ${args.options}
- **Candidate's Choice**: Option ${args.candidate_answer.toUpperCase()}
- **Authoritative Key**: Option ${args.correct_answer.toUpperCase()}
- **Result**: ${isCorrect ? "CORRECT" : "INCORRECT"}

---

### Instructions for Evaluation:
Perform a deep pedagogical evaluation covering the following four dimensions:

1. **Option Key & Correctness Explanation**:
   - Explain clearly why Option ${args.correct_answer.toUpperCase()} is grammatically and contextually required.
   - Cite specific textual anchors from the passage/transcript if applicable.

2. **Distractor Analysis & Trap Classification**:
   - Classify the candidate's choice (${args.candidate_answer.toUpperCase()}) against TOEIC trap categories:
     - *Phonetic Trap / Sound-Alike* (Listening Part 1/2: e.g. homophones, similar consonant blends)
     - *Non-Sequitur / Direct Response Trap* (Part 2: answering a WH-question with Yes/No)
     - *Morphological / Word-Form Trap* (Part 5/6: confusing adjective with adverb, noun with gerund)
     - *Scope / False Detail Trap* (Part 7: extreme words, reversed causality, fact mentioned but irrelevant)
   - Explain why an examinee would be tempted by this distractor.

3. **ETS Competency & CEFR Skill Tagging**:
   - Map this question to its core English competency (e.g. *Collocation & Lexis*, *Subject-Verb Agreement*, *Participial Clauses*, *Cross-Passage Inference*).
   - Estimate target proficiency level (CEFR A2, B1, B2, or C1).

4. **Actionable Remediation Rule (The "Takeaway")**:
   - Provide a concise 1-sentence mnemonic or rule of thumb for spotting this pattern instantly in future exams.`,
        },
      },
    ],
  };
}
