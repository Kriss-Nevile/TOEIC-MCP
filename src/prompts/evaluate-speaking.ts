import { z } from "zod";

export const EvaluateSpeakingPromptArgsSchema = {
  session_id: z.string().describe("Session ID of the completed speaking test"),
  candidate_target_level: z
    .string()
    .optional()
    .describe("Optional target score or CEFR/ETS level (e.g., 'Level 7', '160-180', 'B2')"),
};

export function buildEvaluateSpeakingPrompt(args: {
  session_id: string;
  candidate_target_level?: string;
}) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are an expert, certified ETS TOEIC Speaking Examiner.
Your task is to conduct an in-depth, rubric-grounded evaluation of the candidate's recorded voice responses for Session: "${args.session_id}".

Candidate Target: ${args.candidate_target_level || "Not specified (evaluate against general ETS scale)"}

### Evaluation Workflow:
1. If you have not already retrieved the voice recordings, invoke the tool:
   \`get_test_submission(session_id: "${args.session_id}")\` to obtain the recorded audio file paths, durations, and original question prompts.
2. Inspect or listen to each audio recording file located at its respective \`audio_file_path\`.
3. Evaluate every question systematically according to the official ETS TOEIC Speaking Scoring Rubric:

---

### Official ETS TOEIC Speaking Scoring Rubric:

#### Questions 1–2: Read a Text Aloud (Scale: 0–3)
- **Score 3**: Highly intelligible, natural phrasing, correct word stress, accurate vowel/consonant pronunciation, smooth pauses at punctuation.
- **Score 2**: Generally intelligible, minor pronunciation slips or unnatural pauses that do not obscure meaning.
- **Score 1**: Frequent pronunciation and intonation errors that significantly hinder listener comprehension.
- **Score 0**: No response or completely unintelligible.

#### Questions 3–4: Describe a Picture (Scale: 0–3)
- **Score 3**: Broad descriptive vocabulary, accurate prepositions of place (in foreground, background, next to), varied grammatical structures, coherent organization from main subject to background details.
- **Score 2**: Adequate description of main elements, but limited lexical range, minor grammatical errors, or hesitant delivery.
- **Score 1**: Fragmented sentences, severe vocabulary limitations, major inaccuracies describing the visual scene.

#### Questions 5–7: Respond to Questions (Scale: 0–3)
- **Score 3**: Directly answers the prompt, complete sentences, fluent delivery within time limit (15s for Q5-6, 30s for Q7), relevant details or reasons.
- **Score 2**: Answers partially or with noticeable hesitation; minor grammatical or lexical flaws.
- **Score 1**: Off-topic, overly brief, or comprehension breakdown.

#### Questions 8–10: Respond Using Information Provided (Scale: 0–3 for Q8-9, 0–5 for Q10)
- **Score 3 (Q8-9) / 5 (Q10)**: Accurately extracts requested information from the schedule/agenda, resolves conflicting details or cancellations correctly, fluent and professional tone.
- **Score 2 / 3-4**: Information is mostly accurate, minor omissions or awkward phrasing.
- **Score 1 / 1-2**: Inaccurate information conveyed, misunderstandings of schedule data.

#### Question 11: Express an Opinion (Scale: 0–5)
- **Score 5**: Clear thesis statement, strong supporting reasons, illustrative examples, cohesive discourse markers, sophisticated vocabulary and syntactic variety.
- **Score 4**: Clear point of view with reasons, but slightly less elaborated or minor grammatical inconsistencies.
- **Score 3**: Basic opinion stated with limited support or repetitive vocabulary.
- **Score 1-2**: Minimal idea development, severe grammatical breakdown.

---

### Expected Output Format:
For each question, output:
- **Question Number & Type**
- **Raw Score** (e.g. 3/3 or 4/5)
- **Strengths**: Specific positive observations (pronunciation, lexical choice, discourse markers).
- **Areas for Improvement**: Specific phonetic errors, grammatical slips, or content gaps.
- **Actionable Remediation**: A concrete tip for the candidate.

### Final Summary:
- **Estimated Scaled Score**: (0 to 200 points)
- **ETS Speaking Proficiency Level**:
  - Level 1 (0–30)
  - Level 2 (40–50)
  - Level 3 (60–70)
  - Level 4 (80–100)
  - Level 5 (110–120)
  - Level 6 (130–150)
  - Level 7 (160–180)
  - Level 8 (190–200)
- **Prioritized Action Plan**: Top 3 high-leverage drills for the candidate to raise their score.`,
        },
      },
    ],
  };
}
