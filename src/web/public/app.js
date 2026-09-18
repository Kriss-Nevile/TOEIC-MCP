import { playStartBeep, playChime } from "./sounds.js";

// App State
let sessionId = null;
let sessionData = null;
let currentQuestionIndex = 0;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let questionBlobs = {}; // questionNumber -> { blob, url, duration }

// Audio Visualizer
let audioContext = null;
let analyser = null;
let animFrameId = null;

// Timer
let timerInterval = null;
let currentPhase = "prep"; // "prep" | "speak"
let timeLeft = 0;
let totalPhaseTime = 0;

// DOM Elements
const badgeSessionId = document.getElementById("badge-session-id");
const viewSetup = document.getElementById("view-setup");
const viewExam = document.getElementById("view-exam");
const viewReview = document.getElementById("view-review");
const viewFinished = document.getElementById("view-finished");

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
const micWaveBars = document.querySelectorAll(".wave-bar");

const reviewList = document.getElementById("review-list");
const btnSubmitEvaluation = document.getElementById("btn-submit-evaluation");

// Question Type Labels & Instructions
const TYPE_CONFIG = {
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
  }
};

// Initialize
async function init() {
  const params = new URLSearchParams(window.location.search);
  sessionId = params.get("session");

  if (!sessionId) {
    alert("No session ID provided in URL (e.g. ?session=spk_...)");
    return;
  }

  badgeSessionId.textContent = `Session: ${sessionId}`;

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error("Failed to load session details");
    sessionData = await res.json();
    
    setupExamSummary.innerHTML = `
      <strong>${sessionData.questions.length}</strong> speaking questions loaded.<br>
      Total estimated duration: ~${Math.ceil(sessionData.questions.reduce((acc, q) => acc + q.prepTimeSeconds + q.responseTimeSeconds, 0) / 60)} minutes.
    `;
  } catch (err) {
    console.error(err);
    alert(`Could not load test session: ${err.message}`);
  }

  setupEventListeners();
}

function setupEventListeners() {
  btnRequestMic.addEventListener("click", enableMicrophone);
  btnStartExam.addEventListener("click", startExam);
  btnSubmitEvaluation.addEventListener("click", submitFinalEvaluation);
}

// Microphone Setup & Audio Meter
async function enableMicrophone() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    btnRequestMic.textContent = "✅ Microphone Connected";
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

    // Update wave bars if active
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

function loadCurrentQuestion() {
  const question = sessionData.questions[currentQuestionIndex];
  if (!question) {
    finishExam();
    return;
  }

  // Update question counters & headers
  examQCounter.textContent = `Question ${question.questionNumber} of ${sessionData.questions.length}`;
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

  // Start Preparation Phase
  startPreparationPhase(question);
}

function startPreparationPhase(question) {
  currentPhase = "prep";
  totalPhaseTime = question.prepTimeSeconds || 45;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-prep";
  timerPhaseText.textContent = "PREPARATION TIME";
  updateTimerDisplay();

  playChime();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      startSpeakingPhase(question);
    }
  }, 1000);
}

function startSpeakingPhase(question) {
  currentPhase = "speak";
  totalPhaseTime = question.responseTimeSeconds || 45;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-speak";
  timerPhaseText.textContent = "RECORDING NOW";
  updateTimerDisplay();

  // Authentic exam start tone
  playStartBeep();

  // Start MediaRecorder
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

// Media Recording
function startRecording(question) {
  recordedChunks = [];
  try {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.start(250); // Slice every 250ms
  } catch (err) {
    console.error("Failed to start MediaRecorder:", err);
  }
}

function stopRecordingAndNext(question) {
  playChime();

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = async () => {
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      const durationSeconds = question.responseTimeSeconds;
      const audioUrl = URL.createObjectURL(blob);

      questionBlobs[question.questionNumber] = {
        blob,
        url: audioUrl,
        duration: durationSeconds,
        question
      };

      // Upload recording immediately in background
      await uploadQuestionAudio(question.questionNumber, blob, durationSeconds);

      // Move to next question
      currentQuestionIndex++;
      loadCurrentQuestion();
    };

    mediaRecorder.stop();
  } else {
    currentQuestionIndex++;
    loadCurrentQuestion();
  }
}

async function uploadQuestionAudio(questionNumber, blob, durationSeconds) {
  const formData = new FormData();
  formData.append("questionNumber", String(questionNumber));
  formData.append("durationSeconds", String(durationSeconds));
  formData.append("audio", blob, `q${questionNumber}.webm`);

  try {
    const res = await fetch(`/api/sessions/${sessionId}/recordings`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      console.error(`Failed to upload audio for question ${questionNumber}`);
    }
  } catch (err) {
    console.error(`Network error uploading audio for question ${questionNumber}:`, err);
  }
}

// Review & Finish
function finishExam() {
  clearInterval(timerInterval);
  viewExam.style.display = "none";
  viewReview.style.display = "flex";

  renderReviewList();
}

function renderReviewList() {
  reviewList.innerHTML = "";

  sessionData.questions.forEach((q) => {
    const item = document.createElement("div");
    item.className = "review-item";

    const saved = questionBlobs[q.questionNumber];
    const url = saved ? saved.url : null;

    item.innerHTML = `
      <div>
        <strong>Question ${q.questionNumber}</strong>
        <span style="color: var(--text-muted); font-size: 0.85rem; margin-left: 0.5rem;">
          (${q.questionType})
        </span>
        <div style="font-size: 0.9rem; color: #cbd5e1; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${q.promptText}
        </div>
      </div>
      <div>
        ${url ? `<audio class="audio-preview" controls src="${url}"></audio>` : `<span style="color: #ef4444;">Missing recording</span>`}
      </div>
    `;

    reviewList.appendChild(item);
  });
}

async function submitFinalEvaluation() {
  btnSubmitEvaluation.disabled = true;
  btnSubmitEvaluation.textContent = "⏳ Finalizing Submission...";

  try {
    const res = await fetch(`/api/sessions/${sessionId}/submit`, {
      method: "POST"
    });

    if (!res.ok) throw new Error("Failed to finalize submission on server");

    viewReview.style.display = "none";
    viewFinished.style.display = "block";
  } catch (err) {
    alert(`Submission error: ${err.message}`);
    btnSubmitEvaluation.disabled = false;
    btnSubmitEvaluation.textContent = "🚀 Submit Recordings to AI Agent";
  }
}

// Run init on DOM ready
document.addEventListener("DOMContentLoaded", init);
