import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvaluateSpeakingPrompt } from "../src/prompts/evaluate-speaking.js";
import { buildEvaluateWritingPrompt } from "../src/prompts/evaluate-writing.js";
import { buildEvaluateQuestionPrompt } from "../src/prompts/evaluate-question.js";
import { buildDiagnoseWeaknessesPrompt } from "../src/prompts/diagnose-weaknesses.js";
import { buildGenerateTargetedLessonPrompt } from "../src/prompts/generate-targeted-lesson.js";

test("buildEvaluateSpeakingPrompt returns valid user message with rubric", () => {
  const prompt = buildEvaluateSpeakingPrompt({
    session_id: "spk_123_abc",
    candidate_target_level: "Level 7 (160-180)",
  });

  assert.equal(prompt.messages.length, 1);
  assert.equal(prompt.messages[0].role, "user");
  assert.ok(prompt.messages[0].content.text.includes("spk_123_abc"));
  assert.ok(prompt.messages[0].content.text.includes("Level 7"));
  assert.ok(prompt.messages[0].content.text.includes("Questions 1–2: Read a Text Aloud"));
});

test("buildEvaluateWritingPrompt returns valid user message with ETS writing rubric", () => {
  const prompt = buildEvaluateWritingPrompt({
    session_id: "wrt_123_xyz",
    candidate_target_level: "Level 8 (170-190)",
  });

  assert.equal(prompt.messages.length, 1);
  assert.equal(prompt.messages[0].role, "user");
  const text = prompt.messages[0].content.text;
  assert.ok(text.includes("wrt_123_xyz"));
  assert.ok(text.includes("Level 8"));
  assert.ok(text.includes("Questions 1–5: Write a Sentence Based on a Picture"));
  assert.ok(text.includes("Questions 6–7: Respond to a Written Request"));
  assert.ok(text.includes("Question 8: Write an Opinion Essay"));
  assert.ok(text.includes("0 to 200 points"));
});


test("buildEvaluateQuestionPrompt returns valid distractor analysis instructions", () => {
  const prompt = buildEvaluateQuestionPrompt({
    part: "5",
    question_text: "The quarterly financial report must be reviewed _____ by Friday.",
    options: "A: thorough, B: thoroughly, C: thoroughness, D: more thorough",
    candidate_answer: "A",
    correct_answer: "B",
    context_or_transcript: "Quarterly Audit Memo",
  });

  assert.equal(prompt.messages.length, 1);
  const text = prompt.messages[0].content.text;
  assert.ok(text.includes("Part 5"));
  assert.ok(text.includes("Option A"));
  assert.ok(text.includes("Option B"));
  assert.ok(text.includes("Distractor Analysis & Trap Classification"));
  assert.ok(text.includes("Actionable Remediation Rule"));
});

test("buildDiagnoseWeaknessesPrompt synthesizes exam results", () => {
  const prompt = buildDiagnoseWeaknessesPrompt({
    exam_summary: "Listening: 65/100, Reading: 52/100. High errors in Part 3 and Part 7.",
    target_score: "850+",
  });

  assert.equal(prompt.messages.length, 1);
  const text = prompt.messages[0].content.text;
  assert.ok(text.includes("Target Score: 850+"));
  assert.ok(text.includes("Listening: 65/100"));
  assert.ok(text.includes("Part-by-Part Vulnerability Matrix"));
  assert.ok(text.includes("3-Phase Targeted Remediation Plan"));
});

test("buildGenerateTargetedLessonPrompt produces structured lesson format", () => {
  const prompt = buildGenerateTargetedLessonPrompt({
    topic: "Gerunds vs Infinitives after Prepositions",
    difficulty: "intermediate",
    target_part: "Part 5",
  });

  assert.equal(prompt.messages.length, 1);
  const text = prompt.messages[0].content.text;
  assert.ok(text.includes("Gerunds vs Infinitives"));
  assert.ok(text.includes("intermediate"));
  assert.ok(text.includes("The \"Trap Breakdown\""));
  assert.ok(text.includes("Authentic Practice Drill"));
});
