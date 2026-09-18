import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { handleLaunchSpeakingTest } from "../src/tools/launch-speaking-test.js";
import { handleGetTestSubmission } from "../src/tools/get-test-submission.js";
import { stopWebServer } from "../src/web/server.js";
import { SpeakingQuestion } from "../src/domain/types.js";

const sampleQuestions: SpeakingQuestion[] = [
  {
    questionNumber: 1,
    questionType: "read_aloud",
    promptText: "Thank you for calling Apex Logistics. Our offices are currently closed.",
    prepTimeSeconds: 5,
    responseTimeSeconds: 5,
    evaluationFocus: ["pronunciation", "intonation"],
  },
  {
    questionNumber: 2,
    questionType: "describe_picture",
    promptText: "Describe what you see in the office meeting room.",
    prepTimeSeconds: 5,
    responseTimeSeconds: 5,
  },
];

test("handleLaunchSpeakingTest creates session and returns launch metadata", async () => {
  const res = await handleLaunchSpeakingTest({
    questions: sampleQuestions,
    auto_open_browser: false,
  });

  assert.equal(res.content.length, 1);
  const data = JSON.parse(res.content[0].text);

  assert.equal(data.status, "launched");
  assert.ok(data.session_id.startsWith("spk_"));
  assert.ok(data.web_url.includes(data.session_id));
  assert.equal(data.questions_count, 2);
  assert.ok(fs.existsSync(data.audio_destination_folder));

  // Verify get_test_submission for newly created pending session
  const subRes = await handleGetTestSubmission({
    session_id: data.session_id,
  });

  const subData = JSON.parse(subRes.content[0].text);
  assert.equal(subData.session_id, data.session_id);
  assert.equal(subData.status, "pending");
  assert.equal(subData.total_questions, 2);
  assert.equal(subData.recordings_count, 0);
  assert.equal(subData.is_ready_for_evaluation, false);

  // Clean up
  fs.rmSync(data.audio_destination_folder, { recursive: true, force: true });
  await stopWebServer();
});

test("handleGetTestSubmission handles non-existent session cleanly", async () => {
  const res = await handleGetTestSubmission({
    session_id: "non_existent_session_999",
  });

  assert.equal(res.isError, true);
  assert.ok(res.content[0].text.includes("Session not found"));
});
