import { playStartBeep, playChime } from "./sounds.js";
import { WavAudioRecorder } from "./wav-recorder.js";

// App State
let sessionId = null;
let sessionData = null;
let isWritingTest = false;
let currentQuestionIndex = 0;
let mediaStream = null;
let wavRecorder = null;
let activeRerecord = null;
let questionBlobs = {}; // questionNumber -> { blob, url, duration, question }
let writtenAnswers = {}; // questionNumber -> { text, durationSeconds, question }
let cheatModeActive = false;

// Audio Visualizer (Speaking)
let audioContext = null;
let analyser = null;
let animFrameId = null;

// Timer
let timerInterval = null;
let currentPhase = "prep"; // "prep" | "speak" | "write"
let timeLeft = 0;
let totalPhaseTime = 0;

// DOM Elements
const brandIcon = document.getElementById("brand-icon");
const brandTitle = document.getElementById("brand-title");
const badgeSessionId = document.getElementById("badge-session-id");
const badgeSessionMode = document.getElementById("badge-session-mode");
const viewSetup = document.getElementById("view-setup");
const viewExam = document.getElementById("view-exam");
const viewReview = document.getElementById("view-review");
const viewFinished = document.getElementById("view-finished");

const setupTitle = document.getElementById("setup-title");
const setupDesc = document.getElementById("setup-desc");
const setupMicBox = document.getElementById("setup-mic-box");
const setupWritingBox = document.getElementById("setup-writing-box");
const setupMicFill = document.getElementById("setup-mic-fill");
const btnRequestMic = document.getElementById("btn-request-mic");
const btnStartExam = document.getElementById("btn-start-exam");
const setupExamSummary = document.getElementById("setup-exam-summary");

const examQCounter = document.getElementById("exam-q-counter");
const examQType = document.getElementById("exam-q-type");
const timerCard = document.getElementById("timer-card");
const timerPhaseText = document.getElementById("timer-phase-text");
const timerDisplay = document.getElementById("timer-display");
const timerProgressBar = document.getElementById("timer-progress-bar");

const promptInstructions = document.getElementById("prompt-instructions");
const promptPassage = document.getElementById("prompt-passage");
const promptMedia = document.getElementById("prompt-media");
const promptImage = document.getElementById("prompt-image");
const promptContext = document.getElementById("prompt-context");

// Speaking Indicator
const micActivityCard = document.getElementById("mic-activity-card");
const micWaveBars = document.querySelectorAll(".wave-bar");

// Writing Area
const writingInputCard = document.getElementById("writing-input-card");
const writingTextarea = document.getElementById("writing-textarea");
const writingWordCount = document.getElementById("writing-word-count");
const writingCharCount = document.getElementById("writing-char-count");
const writingTargetCount = document.getElementById("writing-target-count");
const btnNextQuestion = document.getElementById("btn-next-question");

const reviewList = document.getElementById("review-list");
const reviewTitle = document.getElementById("review-title");
const reviewDesc = document.getElementById("review-desc");
const btnSubmitEvaluation = document.getElementById("btn-submit-evaluation");
const btnCheatMode = document.getElementById("btn-cheat-mode");
const btnViewSubmitted = document.getElementById("btn-view-submitted-recordings");

// Question Type Labels & Instructions
const TYPE_CONFIG = {
  // Speaking Parts
  read_aloud: {
    badge: "Questions 1-2: Read Aloud",
    instructions: "Read the text below aloud. Pronounce clearly with natural intonation and stress."
  },
  describe_picture: {
    badge: "Questions 3-4: Describe Picture",
    instructions: "Describe the picture below in as much detail as possible."
  },
  respond_to_questions: {
    badge: "Questions 5-7: Respond to Questions",
    instructions: "Respond to the following scenario and question as completely as possible."
  },
  respond_with_info: {
    badge: "Questions 8-10: Respond Using Information",
    instructions: "Refer to the information provided to answer the questions."
  },
  express_opinion: {
    badge: "Question 11: Express an Opinion",
    instructions: "State your opinion clearly with supporting reasons, examples, or details."
  },
  // Writing Parts
  write_sentence: {
    badge: "Questions 1-5: Write a Sentence",
    instructions: "Write ONE sentence based on the picture using both given words/phrases correctly."
  },
  respond_request: {
    badge: "Questions 6-7: Respond to Request",
    instructions: "Read the email or written memo below and write a comprehensive professional response."
  },
  write_opinion: {
    badge: "Question 8: Write an Opinion Essay",
    instructions: "State, explain, and support your opinion on the topic below. Aim for at least 300 words."
  }
};

// Initialize
async function init() {
  const params = new URLSearchParams(window.location.search);
  sessionId = params.get("session");

  if (!sessionId) {
    alert("No session ID provided in URL (e.g. ?session=spk_... or ?session=wrt_...)");
    return;
  }

  if (badgeSessionId) {
    badgeSessionId.textContent = `Session: ${sessionId}`;
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error("Failed to load session details");
    sessionData = await res.json();

    isWritingTest = Boolean(sessionData.testType === "writing" || sessionId.startsWith("wrt_"));

    // Adapt Branding and Page Headers
    if (isWritingTest) {
      document.title = "TOEIC Writing Test Simulator";
      if (brandIcon) brandIcon.textContent = "✍️";
      if (brandTitle) brandTitle.textContent = "TOEIC Writing Simulator";
    } else {
      document.title = "TOEIC Speaking Test Simulator";
      if (brandIcon) brandIcon.textContent = "🎙️";
      if (brandTitle) brandTitle.textContent = "TOEIC Speaking Simulator";
    }

    // Check if session has already been completed / submitted
    if (sessionData.status === "completed") {
      handleAlreadyCompletedSession();
      setupEventListeners();
      return;
    }

    if (badgeSessionMode) {
      badgeSessionMode.textContent = sessionData.isDrill ? "Targeted Drill" : "Official Format";
      badgeSessionMode.className = `badge ${sessionData.isDrill ? "badge-drill" : "badge-official"}`;
    }

    // Setup screen configuration
    if (isWritingTest) {
      if (setupTitle) {
        setupTitle.textContent = sessionData.title || (sessionData.isDrill ? "Targeted Writing Drill" : "Full Writing Mock Test");
      }
      if (setupDesc) {
        setupDesc.textContent =
          "Welcome to the TOEIC Writing Test simulation. Review the exam guidelines below before beginning your test.";
      }
      if (setupMicBox) setupMicBox.style.display = "none";
      if (setupWritingBox) setupWritingBox.style.display = "flex";

      if (btnStartExam) {
        btnStartExam.disabled = false;
        btnStartExam.textContent = "Start Writing Test";
      }
    } else {
      if (setupTitle && sessionData.title) {
        setupTitle.textContent = sessionData.title;
      }
      if (setupMicBox) setupMicBox.style.display = "flex";
      if (setupWritingBox) setupWritingBox.style.display = "none";
    }

    const durationTotalSec = sessionData.questions.reduce(
      (acc, q) => acc + (q.prepTimeSeconds || 0) + (q.responseTimeSeconds || 45),
      0
    );
    const durationMin = Math.ceil(durationTotalSec / 60);

    if (setupExamSummary) {
      setupExamSummary.innerHTML = `
        <strong>${sessionData.title || (isWritingTest ? "TOEIC Writing Test" : "TOEIC Speaking Test")}</strong><br>
        Questions: ${sessionData.questions.map(q => `Q${q.questionNumber}`).join(", ")} (${sessionData.questions.length} total)<br>
        Total allocated duration: ~${durationMin} minute${durationMin !== 1 ? "s" : ""}.
      `;
    }
  } catch (err) {
    console.error(err);
    alert(`Could not load test session: ${err.message}`);
  }

  setupEventListeners();
}

function handleAlreadyCompletedSession() {
  viewSetup.style.display = "none";
  viewExam.style.display = "none";
  viewReview.style.display = "none";
  viewFinished.style.display = "block";

  const finishedTitle = document.getElementById("finished-title");
  const finishedDesc = document.getElementById("finished-desc");
  const finishedMeta = document.getElementById("finished-meta");

  if (finishedTitle) {
    finishedTitle.textContent = isWritingTest ? "Writing Test Completed & Locked" : "Test Session Completed & Locked";
  }

  if (finishedDesc) {
    const completedDate = sessionData.completedAt 
      ? new Date(sessionData.completedAt).toLocaleString() 
      : "earlier";
    finishedDesc.innerHTML = `
      This test session was completed on <strong>${completedDate}</strong>.<br>
      Your responses are saved locally in your configured storage directory.
      To preserve test integrity, completed sessions cannot be modified.
    `;
  }

  if (finishedMeta) {
    finishedMeta.textContent = isWritingTest
      ? "Return to your chat and ask your AI agent to retrieve your written submissions and generate your rubric evaluation."
      : "Return to your chat and ask your AI agent to retrieve the recordings and generate your evaluation.";
  }

  if (btnViewSubmitted) {
    btnViewSubmitted.textContent = isWritingTest ? "Review Saved Responses" : "Listen to Saved Audio";
  }

  // Populate state from server submissions
  if (sessionData.submissions) {
    if (isWritingTest) {
      Object.values(sessionData.submissions).forEach((sub) => {
        writtenAnswers[sub.questionNumber] = {
          text: sub.writtenText || "",
          durationSeconds: sub.durationSeconds || 0,
          question: sessionData.questions.find((q) => q.questionNumber === sub.questionNumber)
        };
      });
    } else {
      Object.values(sessionData.submissions).forEach((sub) => {
        questionBlobs[sub.questionNumber] = {
          blob: null,
          url: `/api/sessions/${sessionId}/recordings/${sub.audioFileName}`,
          duration: sub.durationSeconds,
          question: sessionData.questions.find((q) => q.questionNumber === sub.questionNumber)
        };
      });
    }
  }
}

function openSubmittedReview() {
  viewFinished.style.display = "none";
  viewReview.style.display = "flex";

  if (reviewTitle) {
    reviewTitle.textContent = isWritingTest ? "Saved Written Responses" : "Recorded Voice Samples";
  }
  if (reviewDesc) {
    reviewDesc.textContent = isWritingTest
      ? "Review the written text responses saved locally for this test session."
      : "Listen back to the voice recordings saved locally for this test session.";
  }

  renderReviewList();

  if (btnCheatMode) {
    btnCheatMode.style.display = "none";
  }

  btnSubmitEvaluation.disabled = false;
  btnSubmitEvaluation.textContent = "← Return to Summary Screen";
  btnSubmitEvaluation.classList.remove("btn-success");
  btnSubmitEvaluation.classList.add("btn-primary");
  btnSubmitEvaluation.style.opacity = "1";
  btnSubmitEvaluation.style.cursor = "pointer";
  btnSubmitEvaluation.onclick = () => {
    viewReview.style.display = "none";
    viewFinished.style.display = "block";
  };
}

function setupEventListeners() {
  if (btnRequestMic) {
    btnRequestMic.addEventListener("click", enableMicrophone);
  }
  if (btnStartExam) {
    btnStartExam.addEventListener("click", startExam);
  }
  if (btnSubmitEvaluation) {
    btnSubmitEvaluation.addEventListener("click", saveAllResponsesOrRecordings);
  }

  if (btnCheatMode) {
    btnCheatMode.addEventListener("click", () => {
      cheatModeActive = true;
      btnCheatMode.disabled = true;
      btnCheatMode.textContent = "Cheat Mode Active";
      if (reviewDesc) {
        reviewDesc.textContent = isWritingTest
          ? "Cheat Mode Active: Response editing unlocked! You can now edit any written response before saving."
          : "Cheat Mode Active: Re-recording options unlocked! You can now re-record any question before saving.";
      }
      renderReviewList();
    });
  }

  if (btnViewSubmitted) {
    btnViewSubmitted.addEventListener("click", openSubmittedReview);
  }

  if (writingTextarea) {
    writingTextarea.addEventListener("input", updateWritingLiveStats);
  }

  if (btnNextQuestion) {
    btnNextQuestion.addEventListener("click", handleNextQuestionClick);
  }
}

// Microphone Setup & Audio Meter (Speaking Only)
async function enableMicrophone() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 48000, min: 44100 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    btnRequestMic.textContent = "Microphone Connected";
    btnRequestMic.classList.remove("btn-primary");
    btnRequestMic.classList.add("btn-success");
    btnStartExam.disabled = false;

    // Start setup visualizer
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    renderSetupMeter();
  } catch (err) {
    console.error("Microphone access denied:", err);
    alert("Microphone access is required for the TOEIC Speaking test. Please allow permissions in your browser.");
  }
}

function renderSetupMeter() {
  if (!analyser) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function loop() {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const percent = Math.min(100, Math.round((avg / 128) * 100));
    if (setupMicFill) {
      setupMicFill.style.width = `${percent}%`;
    }

    if (micWaveBars && micWaveBars.length > 0) {
      micWaveBars.forEach((bar, idx) => {
        const val = dataArray[idx % dataArray.length] || 0;
        const height = Math.max(4, Math.min(20, (val / 255) * 20));
        bar.style.height = `${height}px`;
        if (val > 40) {
          bar.classList.add("active");
        } else {
          bar.classList.remove("active");
        }
      });
    }

    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

// Exam Flow
function startExam() {
  viewSetup.style.display = "none";
  viewExam.style.display = "flex";
  currentQuestionIndex = 0;
  loadCurrentQuestion();
}

function countWords(str) {
  if (!str) return 0;
  const trimmed = str.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function updateWritingLiveStats() {
  if (!writingTextarea) return;
  const text = writingTextarea.value || "";
  const words = countWords(text);
  const chars = text.length;

  if (writingWordCount) {
    writingWordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  }
  if (writingCharCount) {
    writingCharCount.textContent = `${chars} char${chars !== 1 ? "s" : ""}`;
  }
}

function loadCurrentQuestion() {
  const question = sessionData.questions[currentQuestionIndex];
  if (!question) {
    finishExam();
    return;
  }

  // Update question counters & headers
  const currentItemNum = currentQuestionIndex + 1;
  const totalItems = sessionData.questions.length;
  examQCounter.textContent = sessionData.isDrill
    ? `Question ${question.questionNumber} (${currentItemNum} of ${totalItems} in drill)`
    : `Question ${question.questionNumber} of ${totalItems}`;

  const conf = TYPE_CONFIG[question.questionType] || {
    badge: question.questionType,
    instructions: "Respond to the question prompt."
  };
  examQType.textContent = conf.badge;
  promptInstructions.textContent = conf.instructions;

  // Render Prompt Content
  promptPassage.textContent = question.promptText || "";

  if (question.imageUrl) {
    promptImage.src = question.imageUrl;
    promptMedia.style.display = "flex";
  } else {
    promptMedia.style.display = "none";
  }

  if (question.contextData) {
    promptContext.textContent = question.contextData;
    promptContext.style.display = "block";
  } else {
    promptContext.style.display = "none";
  }

  if (isWritingTest) {
    // Hide speaking mic activity, show writing input card
    if (micActivityCard) micActivityCard.style.display = "none";
    if (writingInputCard) writingInputCard.style.display = "flex";

    // Set textarea
    const savedAnswer = writtenAnswers[question.questionNumber];
    writingTextarea.value = savedAnswer ? savedAnswer.text : "";
    updateWritingLiveStats();

    if (question.minWords && question.minWords > 0) {
      if (writingTargetCount) {
        writingTargetCount.style.display = "inline-block";
        writingTargetCount.textContent = `Target: ${question.minWords}+ words`;
      }
    } else {
      if (writingTargetCount) writingTargetCount.style.display = "none";
    }

    if (btnNextQuestion) {
      btnNextQuestion.textContent = currentQuestionIndex === totalItems - 1 ? "Finish & Review →" : "Next Question →";
    }

    // Handle prep phase if configured, else start writing immediately
    if (question.prepTimeSeconds && question.prepTimeSeconds > 0) {
      startPreparationPhase(question);
    } else {
      startWritingPhase(question);
    }
  } else {
    // Speaking Test
    if (micActivityCard) micActivityCard.style.display = "flex";
    if (writingInputCard) writingInputCard.style.display = "none";
    startPreparationPhase(question);
  }
}

function startPreparationPhase(question) {
  currentPhase = "prep";
  totalPhaseTime = question.prepTimeSeconds || 45;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-prep";
  timerPhaseText.textContent = "PREPARATION TIME";
  updateTimerDisplay();

  playChime();

  if (isWritingTest && writingTextarea) {
    writingTextarea.disabled = true;
  }

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (isWritingTest) {
        startWritingPhase(question);
      } else {
        startSpeakingPhase(question);
      }
    }
  }, 1000);
}

function startWritingPhase(question) {
  currentPhase = "write";
  totalPhaseTime = question.responseTimeSeconds || 480;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-speak";
  timerPhaseText.textContent = "WRITING TIME";
  updateTimerDisplay();

  playStartBeep();

  if (writingTextarea) {
    writingTextarea.disabled = false;
    writingTextarea.focus();
  }

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      saveCurrentWritingAnswer(question);
      currentQuestionIndex++;
      loadCurrentQuestion();
    }
  }, 1000);
}

function handleNextQuestionClick() {
  const question = sessionData.questions[currentQuestionIndex];
  if (!question) return;

  clearInterval(timerInterval);
  saveCurrentWritingAnswer(question);
  playChime();

  currentQuestionIndex++;
  loadCurrentQuestion();
}

function saveCurrentWritingAnswer(question) {
  const text = writingTextarea ? writingTextarea.value : "";
  const duration = totalPhaseTime > 0 ? totalPhaseTime - Math.max(0, timeLeft) : 0;
  writtenAnswers[question.questionNumber] = {
    text,
    durationSeconds: duration,
    question
  };
}

function startSpeakingPhase(question) {
  currentPhase = "speak";
  totalPhaseTime = question.responseTimeSeconds || 45;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-speak";
  timerPhaseText.textContent = "RECORDING NOW";
  updateTimerDisplay();

  playStartBeep();
  startRecording(question);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      stopRecordingAndNext(question);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  timerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const pct = totalPhaseTime > 0 ? ((totalPhaseTime - timeLeft) / totalPhaseTime) * 100 : 0;
  timerProgressBar.style.width = `${pct}%`;
}

// High-Fidelity WAV Recording (Speaking)
async function startRecording(question) {
  try {
    wavRecorder = new WavAudioRecorder(audioContext, mediaStream);
    await wavRecorder.start();
  } catch (err) {
    console.error("Failed to start WavAudioRecorder:", err);
  }
}

async function stopRecordingAndNext(question) {
  playChime();

  if (wavRecorder && wavRecorder.isRecording) {
    try {
      const { blob: wavBlob, durationSeconds } = await wavRecorder.stop();
      const audioUrl = URL.createObjectURL(wavBlob);

      questionBlobs[question.questionNumber] = {
        blob: wavBlob,
        url: audioUrl,
        duration: durationSeconds,
        question
      };
    } catch (err) {
      console.error("Failed to stop and process WAV recording:", err);
    }
  }

  currentQuestionIndex++;
  loadCurrentQuestion();
}

async function uploadQuestionAudio(questionNumber, blob, durationSeconds) {
  const formData = new FormData();
  formData.append("questionNumber", String(questionNumber));
  formData.append("durationSeconds", String(durationSeconds));
  formData.append("audio", blob, `q${questionNumber}.wav`);

  const res = await fetch(`/api/sessions/${sessionId}/recordings`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) {
    throw new Error(`Failed to upload audio for question ${questionNumber}`);
  }
}

async function uploadQuestionWriting(questionNumber, writtenText, durationSeconds) {
  const res = await fetch(`/api/sessions/${sessionId}/writing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionNumber,
      writtenText,
      durationSeconds
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to upload written response for question ${questionNumber}`);
  }
}

function finishExam() {
  clearInterval(timerInterval);
  viewExam.style.display = "none";
  viewReview.style.display = "flex";

  cheatModeActive = false;
  if (btnCheatMode) {
    btnCheatMode.style.display = "inline-flex";
    btnCheatMode.disabled = false;
    btnCheatMode.textContent = "I want to cheat";
  }

  if (reviewTitle) {
    reviewTitle.textContent = isWritingTest ? "Review Your Written Responses" : "Review Your Recordings";
  }
  if (reviewDesc) {
    reviewDesc.textContent = isWritingTest
      ? "Review your written answers below. When ready, click 'Save All Responses' to persist your submission to disk."
      : "Listen back to your recorded answers in memory. When ready, click below to save everything to your storage folder.";
  }
  if (btnSubmitEvaluation) {
    btnSubmitEvaluation.textContent = isWritingTest ? "Save All Responses" : "Save All Recordings";
  }

  renderReviewList();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderReviewList() {
  reviewList.innerHTML = "";
  const isCompleted = sessionData && sessionData.status === "completed";

  sessionData.questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "review-card";
    card.id = `review-card-${q.questionNumber}`;

    const conf = TYPE_CONFIG[q.questionType] || {
      badge: q.questionType,
      instructions: "Respond to the question prompt."
    };

    const promptText = q.promptText || "";
    const isLongPrompt = promptText.length > 85 || Boolean(q.contextData) || Boolean(q.imageUrl);
    const previewText = isLongPrompt && promptText.length > 85 
      ? promptText.substring(0, 85) + "..." 
      : promptText;

    if (isWritingTest) {
      const saved = writtenAnswers[q.questionNumber];
      const answerText = saved ? saved.text : "";
      const wordCount = countWords(answerText);

      card.innerHTML = `
        <div class="review-card-top">
          <div class="review-card-title">
            <span class="review-q-num">Question ${q.questionNumber}</span>
            <span class="badge badge-part">${conf.badge}</span>
          </div>
          <div class="review-card-meta">
            <span class="review-duration-tag" id="word-tag-${q.questionNumber}">${wordCount} word${wordCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <div class="review-prompt-box">
          <div class="review-prompt-preview" id="prompt-prev-${q.questionNumber}">
            ${escapeHtml(previewText)}
          </div>

          ${isLongPrompt ? `
            <div class="review-prompt-full" id="prompt-full-${q.questionNumber}">
              <div class="review-full-text">${escapeHtml(promptText)}</div>
              ${q.contextData ? `<div class="review-context-block">${escapeHtml(q.contextData)}</div>` : ""}
              ${q.imageUrl ? `<div class="review-image-block"><img src="${escapeHtml(q.imageUrl)}" alt="Question Visual" /></div>` : ""}
            </div>
            <button type="button" class="review-expand-btn" data-q="${q.questionNumber}">
              <span class="expand-icon">▼</span>
              <span class="expand-text">Show full question</span>
            </button>
          ` : ""}
        </div>

        <div class="review-written-box" id="written-box-${q.questionNumber}">
          <div class="review-written-header">
            <span>Written Response:</span>
            ${!isCompleted && cheatModeActive ? `<span style="color: var(--accent-record);">[Editing Enabled]</span>` : ""}
          </div>
          ${!isCompleted && cheatModeActive ? `
            <textarea class="review-textarea-edit" id="edit-textarea-${q.questionNumber}" data-q="${q.questionNumber}">${escapeHtml(answerText)}</textarea>
          ` : `
            <div class="review-written-text">
              ${answerText.trim() ? escapeHtml(answerText) : `<em style="color: var(--text-dim);">(No response written)</em>`}
            </div>
          `}
        </div>
      `;

      if (!isCompleted && cheatModeActive) {
        const editTextarea = card.querySelector(`#edit-textarea-${q.questionNumber}`);
        if (editTextarea) {
          editTextarea.addEventListener("input", (e) => {
            const newText = e.target.value;
            writtenAnswers[q.questionNumber] = {
              text: newText,
              durationSeconds: saved ? saved.durationSeconds : 0,
              question: q
            };
            const wordTag = card.querySelector(`#word-tag-${q.questionNumber}`);
            if (wordTag) {
              const count = countWords(newText);
              wordTag.textContent = `${count} word${count !== 1 ? "s" : ""}`;
            }
          });
        }
      }
    } else {
      // Speaking Test Card
      const saved = questionBlobs[q.questionNumber];
      const url = saved ? saved.url : null;
      const durationSec = saved ? saved.duration : q.responseTimeSeconds;

      card.innerHTML = `
        <div class="review-card-top">
          <div class="review-card-title">
            <span class="review-q-num">Question ${q.questionNumber}</span>
            <span class="badge badge-part">${conf.badge}</span>
          </div>
          <div class="review-card-meta">
            <span class="review-duration-tag" id="duration-tag-${q.questionNumber}">${durationSec}s recorded</span>
          </div>
        </div>

        <div class="review-prompt-box">
          <div class="review-prompt-preview" id="prompt-prev-${q.questionNumber}">
            ${escapeHtml(previewText)}
          </div>

          ${isLongPrompt ? `
            <div class="review-prompt-full" id="prompt-full-${q.questionNumber}">
              <div class="review-full-text">${escapeHtml(promptText)}</div>
              ${q.contextData ? `<div class="review-context-block">${escapeHtml(q.contextData)}</div>` : ""}
              ${q.imageUrl ? `<div class="review-image-block"><img src="${escapeHtml(q.imageUrl)}" alt="Question Visual" /></div>` : ""}
            </div>
            <button type="button" class="review-expand-btn" data-q="${q.questionNumber}">
              <span class="expand-icon">▼</span>
              <span class="expand-text">Show full question</span>
            </button>
          ` : ""}
        </div>

        <div class="review-playback-box" id="playback-box-${q.questionNumber}">
          <div class="playback-label">
            <span>Voice Recording:</span>
          </div>
          ${url 
            ? `<audio class="review-audio-player" controls preload="metadata" src="${url}"></audio>` 
            : `<span class="review-missing">No voice recording captured</span>`
          }
          ${!isCompleted && cheatModeActive ? `
            <div class="review-card-actions">
              <button type="button" class="btn-rerecord" id="btn-rerecord-${q.questionNumber}" data-q="${q.questionNumber}">
                Re-record Answer
              </button>
            </div>
          ` : ""}
        </div>
      `;

      if (!isCompleted && cheatModeActive) {
        const rerecordBtn = card.querySelector(`#btn-rerecord-${q.questionNumber}`);
        if (rerecordBtn) {
          rerecordBtn.addEventListener("click", () => {
            startRerecording(q, card);
          });
        }
      }
    }

    // Connect expand/collapse button for long prompts
    if (isLongPrompt) {
      const expandBtn = card.querySelector(`.review-expand-btn`);
      const fullBox = card.querySelector(`#prompt-full-${q.questionNumber}`);
      const prevBox = card.querySelector(`#prompt-prev-${q.questionNumber}`);
      if (expandBtn && fullBox && prevBox) {
        const icon = expandBtn.querySelector(".expand-icon");
        const label = expandBtn.querySelector(".expand-text");

        expandBtn.addEventListener("click", () => {
          const isExpanded = fullBox.classList.toggle("expanded");
          if (isExpanded) {
            prevBox.style.display = "none";
            if (icon) icon.textContent = "▲";
            if (label) label.textContent = "Collapse question";
          } else {
            prevBox.style.display = "block";
            if (icon) icon.textContent = "▼";
            if (label) label.textContent = "Show full question";
          }
        });
      }
    }

    reviewList.appendChild(card);
  });
}

async function startRerecording(question, card) {
  if (activeRerecord) {
    await stopActiveRerecord();
  }

  const playbackBox = card.querySelector(`#playback-box-${question.questionNumber}`);
  if (!playbackBox) return;

  const totalTime = question.responseTimeSeconds || 45;
  let remaining = totalTime;

  playbackBox.innerHTML = `
    <div class="rerecord-panel" id="rerecord-panel-${question.questionNumber}">
      <div class="rerecord-status">
        <div class="rerecord-pulse"></div>
        <span>Recording Answer: <strong id="rerecord-countdown-${question.questionNumber}">${remaining}</strong>s remaining</span>
      </div>
      <button type="button" class="btn btn-danger" id="btn-stop-rerecord-${question.questionNumber}" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 6px;">
        Stop & Save
      </button>
    </div>
  `;

  btnSubmitEvaluation.disabled = true;
  playStartBeep();

  const recorder = new WavAudioRecorder(audioContext, mediaStream);
  await recorder.start();

  const countdownEl = playbackBox.querySelector(`#rerecord-countdown-${question.questionNumber}`);
  const stopBtn = playbackBox.querySelector(`#btn-stop-rerecord-${question.questionNumber}`);

  const interval = setInterval(async () => {
    remaining--;
    if (countdownEl) countdownEl.textContent = String(remaining);
    if (remaining <= 0) {
      await finishRerecord();
    }
  }, 1000);

  async function finishRerecord() {
    clearInterval(interval);
    playChime();
    try {
      const { blob: wavBlob, durationSeconds } = await recorder.stop();
      const audioUrl = URL.createObjectURL(wavBlob);
      questionBlobs[question.questionNumber] = {
        blob: wavBlob,
        url: audioUrl,
        duration: durationSeconds,
        question
      };
    } catch (err) {
      console.error("Re-recording failed:", err);
    }
    activeRerecord = null;
    btnSubmitEvaluation.disabled = false;
    renderReviewList();
  }

  activeRerecord = { finish: finishRerecord };

  if (stopBtn) {
    stopBtn.addEventListener("click", finishRerecord);
  }
}

async function stopActiveRerecord() {
  if (activeRerecord && typeof activeRerecord.finish === "function") {
    await activeRerecord.finish();
  }
}

async function saveAllResponsesOrRecordings() {
  if (activeRerecord) {
    await stopActiveRerecord();
  }

  btnSubmitEvaluation.disabled = true;

  if (isWritingTest) {
    btnSubmitEvaluation.textContent = "Saving Written Responses...";

    try {
      const questions = sessionData.questions;
      let saved = 0;

      for (const q of questions) {
        saved++;
        btnSubmitEvaluation.textContent = `Saving Responses (${saved}/${questions.length})...`;
        const item = writtenAnswers[q.questionNumber];
        const text = item ? item.text : "";
        const duration = item ? item.durationSeconds : 0;
        await uploadQuestionWriting(q.questionNumber, text, duration);
      }

      btnSubmitEvaluation.textContent = "Completing Session...";
      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: "POST"
      });

      if (!res.ok) throw new Error("Failed to complete session on server");

      if (sessionData) {
        sessionData.status = "completed";
        sessionData.completedAt = new Date().toISOString();
      }

      if (btnCheatMode) {
        btnCheatMode.style.display = "none";
      }

      const finishedTitle = document.getElementById("finished-title");
      const finishedDesc = document.getElementById("finished-desc");
      if (finishedTitle) finishedTitle.textContent = "Responses Saved";
      if (finishedDesc) finishedDesc.textContent = "All written responses for this session have been saved to your local storage folder.";

      btnSubmitEvaluation.removeEventListener("click", saveAllResponsesOrRecordings);
      viewReview.style.display = "none";
      viewFinished.style.display = "block";
    } catch (err) {
      alert(`Save error: ${err.message}`);
      btnSubmitEvaluation.disabled = false;
      btnSubmitEvaluation.textContent = "Save All Responses";
    }
  } else {
    // Speaking
    btnSubmitEvaluation.textContent = "Saving Recordings...";

    try {
      const entries = Object.entries(questionBlobs);
      const validEntries = entries.filter(([, item]) => item.blob);
      const total = validEntries.length;
      let saved = 0;

      for (const [qNumStr, item] of validEntries) {
        saved++;
        btnSubmitEvaluation.textContent = `Saving Recordings (${saved}/${total})...`;
        await uploadQuestionAudio(Number(qNumStr), item.blob, item.duration);
      }

      btnSubmitEvaluation.textContent = "Completing Session...";
      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: "POST"
      });

      if (!res.ok) throw new Error("Failed to complete session on server");

      if (sessionData) {
        sessionData.status = "completed";
        sessionData.completedAt = new Date().toISOString();
      }

      if (btnCheatMode) {
        btnCheatMode.style.display = "none";
      }
      btnSubmitEvaluation.removeEventListener("click", saveAllResponsesOrRecordings);
      viewReview.style.display = "none";
      viewFinished.style.display = "block";
    } catch (err) {
      alert(`Save error: ${err.message}`);
      btnSubmitEvaluation.disabled = false;
      btnSubmitEvaluation.textContent = "Save All Recordings";
    }
  }
}

// Run init on DOM ready
document.addEventListener("DOMContentLoaded", init);
