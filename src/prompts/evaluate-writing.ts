import { z } from "zod";

export const EvaluateWritingPromptArgsSchema = {
  session_id: z.string().describe("Session ID of the completed writing test"),
  candidate_target_level: z
    .string()
    .optional()
    .describe("Optional target score or CEFR/ETS level (e.g., 'Level 7', '150-170', 'B2')"),
};

export function buildEvaluateWritingPrompt(args: {
  session_id: string;
  candidate_target_level?: string;
}) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are an expert, certified ETS TOEIC Writing Examiner.
Your task is to conduct an in-depth, rubric-grounded evaluation of the candidate's written responses for Session: "${args.session_id}".

Candidate Target: ${args.candidate_target_level || "Not specified (evaluate against general ETS scale)"}

### Evaluation Workflow:
1. If you have not already retrieved the candidate's written text submissions, invoke the tool:
   \`get_test_submission(session_id: "${args.session_id}")\` to obtain the question prompts, submitted text, word counts, and metadata.
2. Carefully analyze each written response against the question prompt, visual prompt (if applicable), keywords, or scenario directives.
3. Evaluate every question systematically according to the official ETS TOEIC Writing Scoring Rubric:

---

### Official ETS TOEIC Writing Scoring Rubric:

#### Questions 1–5: Write a Sentence Based on a Picture (Scale: 0–3 each)
- **Score 3**:
  - The sentence has no grammatical errors.
  - Both given words/phrases are used correctly in form and meaning.
  - The sentence clearly, accurately, and relevantly describes the picture.
- **Score 2**:
  - The sentence contains one or two minor grammatical slips (e.g. minor article, preposition, or plural error) that do not obscure meaning.
  - Both given words are used and the relationship to the picture is evident.
- **Score 1**:
  - Contains serious grammatical errors (e.g. fragmented clause, missing predicate, severe word order breakdown).
  - Or fails to use one or both given words correctly.
  - Or the description is poorly related or contradictory to the visual scene.
- **Score 0**:
  - Blank, completely unintelligible, off-topic, or written in a language other than English.

#### Questions 6–7: Respond to a Written Request (Scale: 0–4 each)
- **Score 4**:
  - Fully and professionally addresses all tasks specified in the directions (e.g., asks the required number of questions, provides requested information, and offers a solution).
  - Well-organized with clear paragraphing, natural transitions, and appropriate email register/tone.
  - Demonstrates syntactic variety and precise business vocabulary with minimal minor errors.
- **Score 3**:
  - Addresses all tasks, but one task may be underdeveloped or phrased awkwardly.
  - Generally organized and clear, but with occasional grammatical or lexical errors that do not impair comprehension.
- **Score 2**:
  - Fails to address at least one significant prompt requirement.
  - Or displays noticeable grammatical weaknesses and restricted vocabulary that distract the reader.
- **Score 1**:
  - Only minimally addresses the prompt.
  - Severe organizational deficiencies, frequent grammatical breakdowns, and poor cohesion.
- **Score 0**:
  - Blank, uninterpretable, or completely off-topic.

#### Question 8: Write an Opinion Essay (Scale: 0–5)
- **Score 5**:
  - Expresses a clear, unequivocal thesis statement.
  - Well-developed arguments with strong, relevant reasons and concrete examples.
  - Highly organized structure: cohesive introduction, logically sequenced body paragraphs, and conclusion.
  - Exhibits syntactic complexity, sophisticated lexical resource, and smooth discourse markers with only rare minor mechanical slips.
  - Recommended minimum length: 300 words.
- **Score 4**:
  - Clear thesis and good overall support, though some ideas may be less fully elaborated.
  - Generally well-organized and fluent, with occasional lexical repetition or minor grammatical inconsistencies.
- **Score 3**:
  - Basic point of view supported by general or repetitive arguments.
  - Limited sentence variety, basic vocabulary, or noticeable grammatical inaccuracies that occasionally strain readability.
- **Score 2**:
  - Inadequately developed ideas, major organizational weaknesses, or insufficient length.
  - Frequent grammatical errors that obscure the writer's intended meaning.
- **Score 1**:
  - Severely underdeveloped (e.g. only a few fragmented sentences), largely disjointed, or unintelligible.
- **Score 0**:
  - Blank, copied prompt text verbatim, or off-topic.

---

### Expected Output Format:
For each question:
- **Question Number & Type**
- **Raw Score** (e.g. 3/3, 4/4, or 5/5)
- **Word Count & Response Analysis**
- **Strengths**: Specific positive observations (grammatical precision, vocabulary collocations, cohesion, task completion).
- **Areas for Improvement**: Specific syntactical slips, vocabulary misuse, punctuation errors, or missed prompt directives.
- **Actionable Remediation**: A concrete rule or model revision showing how the response could be elevated.

### Final Summary:
- **Estimated Scaled Score**: (0 to 200 points, calculated from raw score conversion)
- **ETS Writing Proficiency Level**:
  - Level 1 (0–30)
  - Level 2 (40)
  - Level 3 (50–60)
  - Level 4 (70–80)
  - Level 5 (90–100)
  - Level 6 (110–130)
  - Level 7 (140–160)
  - Level 8 (170–190)
  - Level 9 (200)
- **Prioritized Action Plan**: Top 3 high-leverage writing drills and grammatical targets to elevate the candidate's band.`,
        },
      },
    ],
  };
}
