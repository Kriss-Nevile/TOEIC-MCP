import { z } from "zod";

export const DiagnoseWeaknessesPromptArgsSchema = {
  exam_summary: z
    .string()
    .describe("Test results summary, list of incorrect questions, raw score counts, or session scorecard"),
  target_score: z
    .string()
    .optional()
    .describe("Target score or proficiency level (e.g., '750', '850', '900+', 'Speaking Level 7')"),
};

export function buildDiagnoseWeaknessesPrompt(args: {
  exam_summary: string;
  target_score?: string;
}) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are an expert TOEIC Diagnostic Analyst and Exam Strategist.
Your goal is to conduct a thorough diagnostic audit on the learner's test performance and build an actionable study roadmap.

### Learner Test Performance Data:
"""
${args.exam_summary}
"""

Target Score: ${args.target_score || "Maximum attainable score"}

---

### Diagnostic Audit Deliverables:

1. **Current Proficiency & Score Estimate**:
   - Project estimated scaled score and official ETS proficiency band (CEFR A1 through C1).
   - Calculate gap between current estimated score and target (${args.target_score || "N/A"}).

2. **Part-by-Part Vulnerability Matrix (Parts 1–7 / Speaking)**:
   - Identify the primary leak areas (e.g., Part 3 graphic questions, Part 5 prepositions/conjunctions, Part 7 triple passages).
   - Classify error density by section.

3. **Cognitive Error Classification**:
   - Categorize mistakes across three root-cause pillars:
     - **Knowledge Deficits**: Gaps in grammar rules, phrasal verbs, or business vocabulary.
     - **Processing Speed & Strategy**: Running out of time in Reading (Parts 5–7), spending too long per question, or getting stuck.
     - **Distractor Vulnerability**: Susceptibility to sound-alikes, non-sequiturs, or false details.

4. **3-Phase Targeted Remediation Plan**:
   - **Week 1 (Immediate Quick Wins)**: High-frequency grammar and pacing tactics.
   - **Week 2–3 (Skill Consolidation)**: Targeted drills on the 2 weakest parts.
   - **Week 4 (Timed Mock Simulation)**: Full test strategy, answer sheet bubbling speed, and endurance drills.`,
        },
      },
    ],
  };
}
