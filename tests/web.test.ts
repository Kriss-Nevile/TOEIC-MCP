import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startWebServer, stopWebServer } from "../src/web/server.js";
import { createSession } from "../src/domain/session-store.js";
import { handleGetTestSubmission } from "../src/tools/get-test-submission.js";
import { SpeakingQuestion } from "../src/domain/types.js";

const sampleQuestions: SpeakingQuestion[] = [
  {
    questionNumber: 1,
    questionType: "read_aloud",
    promptText: "Please read this sample text aloud.",
    prepTimeSeconds: 45,
    responseTimeSeconds: 45,
  },
];

test("Web API: records audio upload and finishes session", async () => {
  const { port } = await startWebServer(3456);

  // 1. Create a session
  const session = createSession(sampleQuestions);
  assert.ok(session.id);

  // 2. Fetch session details via GET /api/sessions/:id
  const getRes = await fetch(`http://localhost:${port}/api/sessions/${session.id}`);
  assert.equal(getRes.status, 200);
  const getData = (await getRes.json()) as any;
  assert.equal(getData.id, session.id);
  assert.equal(getData.questions.length, 1);

  // 3. Upload a mock audio file via POST /api/sessions/:id/recordings
  const boundary = "----TestBoundary12345";
  const fakeAudioContent = "RIFF....WAVEfmt ....dataFAKEAUDIOBLOB";
  
  const bodyParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="questionNumber"',
    "",
    "1",
    `--${boundary}`,
    'Content-Disposition: form-data; name="durationSeconds"',
    "",
    "42",
    `--${boundary}`,
    'Content-Disposition: form-data; name="audio"; filename="q1.webm"',
    "Content-Type: audio/webm",
    "",
    fakeAudioContent,
    `--${boundary}--`,
  ];
  const payload = bodyParts.join("\r\n");

  const uploadRes = await fetch(`http://localhost:${port}/api/sessions/${session.id}/recordings`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: payload,
  });

  assert.equal(uploadRes.status, 200);
  const uploadData = (await uploadRes.json()) as any;
  assert.equal(uploadData.success, true);
  assert.equal(uploadData.submission.questionNumber, 1);
  assert.ok(fs.existsSync(uploadData.submission.audioFilePath));

  // 4. Submit session via POST /api/sessions/:id/submit
  const submitRes = await fetch(`http://localhost:${port}/api/sessions/${session.id}/submit`, {
    method: "POST",
  });
  assert.equal(submitRes.status, 200);
  const submitData = (await submitRes.json()) as any;
  assert.equal(submitData.status, "completed");

  // 5. Verify that attempting to upload to a completed session is rejected (HTTP 403)
  const rejectedUploadRes = await fetch(`http://localhost:${port}/api/sessions/${session.id}/recordings`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: payload,
  });
  assert.equal(rejectedUploadRes.status, 403);
  const rejectData = (await rejectedUploadRes.json()) as any;
  assert.ok(rejectData.error.includes("already been submitted"));

  // 6. Verify audio file serving endpoint works for playback
  const audioFetchRes = await fetch(`http://localhost:${port}/api/sessions/${session.id}/recordings/q1.webm`);
  assert.equal(audioFetchRes.status, 200);
  assert.ok(audioFetchRes.headers.get("content-type")?.includes("audio/webm"));

  // 7. Test get_test_submission tool returns the completed session with valid file paths
  const toolRes = await handleGetTestSubmission({
    session_id: session.id,
  });
  const parsedToolRes = JSON.parse(toolRes.content[0].text);

  assert.equal(parsedToolRes.status, "completed");
  assert.equal(parsedToolRes.is_ready_for_evaluation, true);
  assert.equal(parsedToolRes.recordings_count, 1);
  assert.equal(parsedToolRes.recordings[0].file_exists, true);
  assert.equal(parsedToolRes.recordings[0].audio_file_name, "q1.webm");
  assert.equal(parsedToolRes.recordings[0].duration_seconds, 42);

  // Clean up
  fs.rmSync(session.recordingsDir, { recursive: true, force: true });
  await stopWebServer();
});
