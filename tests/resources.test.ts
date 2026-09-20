import { test } from "node:test";
import assert from "node:assert/strict";
import { createMcpServer, SERVER_INSTRUCTIONS } from "../src/server.js";
import {
  VISUAL_QUESTIONS_RESOURCE_URI,
  VISUAL_QUESTIONS_GUIDE_TEXT,
} from "../src/resources/visual-questions.js";

test("createMcpServer includes instructions on image sourcing and visual questions", () => {
  const server = createMcpServer();
  assert.ok(server);
  assert.ok(SERVER_INSTRUCTIONS.includes("INTERNET SEARCH FIRST"));
  assert.ok(SERVER_INSTRUCTIONS.includes("STRICT LAST-RESORT SVG FALLBACK"));
  assert.ok(SERVER_INSTRUCTIONS.includes("toeic://guides/visual-questions"));
});

test("visual-questions guide resource content defines internet-first hierarchy and decency criteria", () => {
  assert.equal(VISUAL_QUESTIONS_RESOURCE_URI, "toeic://guides/visual-questions");
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("1. Search Internet for Real Photographs"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("The \"DECENT\" Picture Standard"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("Thematic Authenticity"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("Compositional Density"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("Keyword Compatibility"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("2-tier sourcing hierarchy"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("Recommended Search Strategies"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("Fallback SVG Restrictions"));
  assert.ok(VISUAL_QUESTIONS_GUIDE_TEXT.includes("strictly forbidden"));
});
