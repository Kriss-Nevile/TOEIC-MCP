import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { handleLaunchSpeakingTest } from "../src/tools/launch-speaking-test.js";
import { handleLaunchWritingTest } from "../src/tools/launch-writing-test.js";
import { handleLaunchSpeakingAndWritingTest } from "../src/tools/launch-speaking-and-writing-test.js";
import { handleGetTestSubmission } from "../src/tools/get-test-submission.js";
import { stopWebServer } from "../src/web/server.js";
import { SpeakingQuestion, WritingQuestion } from "../src/domain/types.js";
import { buildWritingParts } from "../src/domain/session-store.js";


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

test("handleLaunchSpeakingTest filters by selected_question_numbers for targeted drills", async () => {
  const res = await handleLaunchSpeakingTest({
    questions: sampleQuestions,
    selected_question_numbers: [2],
    session_title: "Part 2 Photo Drill",
    auto_open_browser: false,
  });

  assert.equal(res.content.length, 1);
  const data = JSON.parse(res.content[0].text);

  assert.equal(data.status, "launched");
  assert.equal(data.mode, "targeted_drill");
  assert.deepEqual(data.practiced_questions, [2]);
  assert.equal(data.questions_count, 1);

  // Verify get_test_submission reflects filtered question count
  const subRes = await handleGetTestSubmission({
    session_id: data.session_id,
  });
  const subData = JSON.parse(subRes.content[0].text);
  assert.equal(subData.total_questions, 1);

  // Clean up
  fs.rmSync(data.audio_destination_folder, { recursive: true, force: true });
  await stopWebServer();
});

test("handleLaunchSpeakingTest rejects selected_question_numbers not present in questions", async () => {
  const res = await handleLaunchSpeakingTest({
    questions: sampleQuestions,
    selected_question_numbers: [5], // Not in sampleQuestions (1, 2)
    auto_open_browser: false,
  });

  assert.equal(res.isError, true);
  assert.ok(res.content[0].text.includes("None of the provided questions"));
});

const sampleWritingQuestions: WritingQuestion[] = [
  {
    questionNumber: 1,
    questionType: "write_sentence",
    promptText: "Write a sentence based on the picture using 'man' and 'computer'.",
    contextData: "man / computer",
    prepTimeSeconds: 0,
    responseTimeSeconds: 60,
  },
  {
    questionNumber: 8,
    questionType: "write_opinion",
    promptText: "Do you agree or disagree that companies should allow employees to work remotely? Give reasons and examples.",
    minWords: 300,
    prepTimeSeconds: 0,
    responseTimeSeconds: 1800,
  },
];


test("handleLaunchWritingTest creates writing session and returns launch metadata in writings folder", async () => {
  const res = await handleLaunchWritingTest({
    questions: sampleWritingQuestions,
    auto_open_browser: false,
  });

  assert.equal(res.content.length, 1);
  const data = JSON.parse(res.content[0].text);

  assert.equal(data.status, "launched");
  assert.ok(data.session_id.startsWith("wrt_"));
  assert.equal(data.test_type, "writing");
  assert.ok(data.web_url.includes(data.session_id));
  assert.equal(data.questions_count, 2);
  assert.ok(fs.existsSync(data.destination_folder));
  // Must save into sessions storage directory (session -> writing), NOT recordings!
  assert.ok(data.destination_folder.includes("sessions") || data.destination_folder.includes("writing"));
  assert.ok(!data.destination_folder.includes("recordings"));

  // Verify parts breakdown
  assert.ok(Array.isArray(data.parts_breakdown));
  assert.equal(data.parts_breakdown.length, 2); // Q1 (Part 1) and Q8 (Part 3)
  assert.equal(data.parts_breakdown[0].part_number, 1);
  assert.equal(data.parts_breakdown[1].part_number, 3);

  // Verify get_test_submission for newly created pending writing session
  const subRes = await handleGetTestSubmission({
    session_id: data.session_id,
  });

  const subData = JSON.parse(subRes.content[0].text);
  assert.equal(subData.session_id, data.session_id);
  assert.equal(subData.test_type, "writing");
  assert.equal(subData.status, "pending");
  assert.equal(subData.total_questions, 2);
  assert.equal(subData.submissions_count, 0);
  assert.equal(subData.is_ready_for_evaluation, false);
  assert.ok(subData.destination_folder.includes("sessions") || subData.destination_folder.includes("writing"));

  // Clean up
  fs.rmSync(data.destination_folder, { recursive: true, force: true });
  await stopWebServer();
});

test("handleLaunchWritingTest supports targeted drill filtering and custom part_times", async () => {
  const res = await handleLaunchWritingTest({
    questions: sampleWritingQuestions,
    selected_question_numbers: [1],
    session_title: "Part 1 Picture Sentence Drill",
    part_times: {
      part1_seconds: 300,
    },
    auto_open_browser: false,
  });

  assert.equal(res.content.length, 1);
  const data = JSON.parse(res.content[0].text);

  assert.equal(data.status, "launched");
  assert.equal(data.mode, "targeted_drill");
  assert.deepEqual(data.practiced_questions, [1]);
  assert.equal(data.questions_count, 1);
  assert.ok(data.destination_folder.includes("sessions") || data.destination_folder.includes("writing"));

  // Check that custom part time was applied
  assert.equal(data.parts_breakdown.length, 1);
  assert.equal(data.parts_breakdown[0].part_number, 1);
  assert.equal(data.parts_breakdown[0].allocated_time_seconds, 300);

  // Clean up
  fs.rmSync(data.destination_folder, { recursive: true, force: true });
  await stopWebServer();
});

test("Speaking and Writing question schemas accept valid direct HTTPS image URLs and fallback data URIs", () => {
  const httpsImageUrl = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80";
  const fallbackSvgUri = "data:image/svg+xml;utf8,<svg viewBox='0 0 800 500' xmlns='http://www.w3.org/2000/svg'><rect width='800' height='500' fill='%23f1f5f9'/></svg>";

  const speakingWithHttps: SpeakingQuestion = {
    questionNumber: 3,
    questionType: "describe_picture",
    promptText: "Describe the picture on your screen in detail.",
    imageUrl: httpsImageUrl,
    prepTimeSeconds: 45,
    responseTimeSeconds: 45,
  };

  const writingWithSvgFallback: WritingQuestion = {
    questionNumber: 1,
    questionType: "write_sentence",
    promptText: "Write a sentence based on the picture using 'manager' and 'presentation'.",
    contextData: "manager / presentation",
    imageUrl: fallbackSvgUri,
    prepTimeSeconds: 0,
    responseTimeSeconds: 120,
  };

  assert.equal(speakingWithHttps.imageUrl, httpsImageUrl);
  assert.equal(writingWithSvgFallback.imageUrl, fallbackSvgUri);
});

test("buildWritingParts correctly partitions questions and allocates ETS-calibrated timers", () => {
  const fullMockQuestions: WritingQuestion[] = [
    // Part 1: Q1-5
    { questionNumber: 1, questionType: "write_sentence", promptText: "Q1", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    { questionNumber: 2, questionType: "write_sentence", promptText: "Q2", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    { questionNumber: 3, questionType: "write_sentence", promptText: "Q3", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    { questionNumber: 4, questionType: "write_sentence", promptText: "Q4", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    { questionNumber: 5, questionType: "write_sentence", promptText: "Q5", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    // Part 2: Q6-7
    { questionNumber: 6, questionType: "respond_request", promptText: "Q6", prepTimeSeconds: 0, responseTimeSeconds: 600 },
    { questionNumber: 7, questionType: "respond_request", promptText: "Q7", prepTimeSeconds: 0, responseTimeSeconds: 600 },
    // Part 3: Q8
    { questionNumber: 8, questionType: "write_opinion", promptText: "Q8", prepTimeSeconds: 0, responseTimeSeconds: 1800 },
  ];

  const parts = buildWritingParts(fullMockQuestions);
  assert.equal(parts.length, 3);

  // Part 1: 5 questions, 8 minutes (480s)
  assert.equal(parts[0].partNumber, 1);
  assert.equal(parts[0].partType, "write_sentence");
  assert.equal(parts[0].questions.length, 5);
  assert.equal(parts[0].timeSeconds, 480);

  // Part 2: 2 questions, 20 minutes (1200s)
  assert.equal(parts[1].partNumber, 2);
  assert.equal(parts[1].partType, "respond_request");
  assert.equal(parts[1].questions.length, 2);
  assert.equal(parts[1].timeSeconds, 1200);

  // Part 3: 1 question, 30 minutes (1800s)
  assert.equal(parts[2].partNumber, 3);
  assert.equal(parts[2].partType, "write_opinion");
  assert.equal(parts[2].questions.length, 1);
  assert.equal(parts[2].timeSeconds, 1800);
});

test("buildWritingParts scales timers proportionally for targeted drills", () => {
  // Part 1 with 2 questions only
  const drillQuestions: WritingQuestion[] = [
    { questionNumber: 1, questionType: "write_sentence", promptText: "Q1", prepTimeSeconds: 0, responseTimeSeconds: 60 },
    { questionNumber: 2, questionType: "write_sentence", promptText: "Q2", prepTimeSeconds: 0, responseTimeSeconds: 60 },
  ];

  const parts = buildWritingParts(drillQuestions);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].partNumber, 1);
  assert.equal(parts[0].questions.length, 2);
  // 2 * 96s = 192s
  assert.equal(parts[0].timeSeconds, 192);

  // Custom part time override
  const customParts = buildWritingParts(drillQuestions, { part1_seconds: 400 });
  assert.equal(customParts[0].timeSeconds, 400);
});

test("handleLaunchSpeakingAndWritingTest launches combined session with structured folders", async () => {
  const speakingQ: SpeakingQuestion[] = [
    {
      questionNumber: 1,
      questionType: "read_aloud",
      promptText: "Please read this announcement clearly.",
      prepTimeSeconds: 5,
      responseTimeSeconds: 5,
    },
  ];

  const writingQ: WritingQuestion[] = [
    {
      questionNumber: 1,
      questionType: "write_sentence",
      promptText: "Write a sentence using the given words.",
      prepTimeSeconds: 0,
      responseTimeSeconds: 60,
    },
  ];

  const res = await handleLaunchSpeakingAndWritingTest({
    speaking_questions: speakingQ,
    writing_questions: writingQ,
    session_title: "Full Speaking & Writing Combined Mock",
    auto_open_browser: false,
  });

  assert.equal(res.content.length, 1);
  const data = JSON.parse(res.content[0].text);

  assert.equal(data.status, "launched");
  assert.equal(data.test_type, "speaking_and_writing");
  assert.ok(data.session_id.startsWith("toeic_"));
  assert.ok(fs.existsSync(data.session_folder));
  assert.ok(fs.existsSync(data.recordings_folder));
  assert.ok(fs.existsSync(data.writing_folder));
  assert.equal(data.speaking_questions_count, 1);
  assert.equal(data.writing_questions_count, 1);

  // Check get_test_submission returns both speaking & writing details
  const subRes = await handleGetTestSubmission({
    session_id: data.session_id,
  });

  assert.equal(subRes.content.length, 1);
  const subData = JSON.parse(subRes.content[0].text);
  assert.equal(subData.session_id, data.session_id);
  assert.equal(subData.test_type, "speaking_and_writing");
  assert.equal(subData.total_questions, 2);
  assert.equal(subData.speaking_questions_count, 1);
  assert.equal(subData.writing_questions_count, 1);
  assert.equal(subData.is_ready_for_evaluation, false);

  // Clean up
  fs.rmSync(data.session_folder, { recursive: true, force: true });
  await stopWebServer();
});

after(async () => {
  await stopWebServer();
});



