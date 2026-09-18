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

    // Check if session has already been completed / submitted
    if (sessionData.status === "completed") {
      handleAlreadyCompletedSession();
      return;
    }

    const badgeMode = document.getElementById("badge-session-mode");
    if (badgeMode) {
      badgeMode.textContent = sessionData.isDrill ? "Targeted Drill" : "Official Format";
      badgeMode.className = `badge ${sessionData.isDrill ? "badge-drill" : "badge-official"}`;
    }

    const setupTitle = document.querySelector(".setup-title");
    if (setupTitle && sessionData.title) {
      setupTitle.textContent = sessionData.title;
    }
    
    setupExamSummary.innerHTML = `
      <strong>${sessionData.title || (sessionData.isDrill ? "Targeted Practice Drill" : "Full Speaking Test")}</strong><br>
      Questions: ${sessionData.questions.map(q => `Q${q.questionNumber}`).join(", ")} (${sessionData.questions.length} total)<br>
      Total estimated duration: ~${Math.ceil(sessionData.questions.reduce((acc, q) => acc + q.prepTimeSeconds + q.responseTimeSeconds, 0) / 60)} minutes.
    `;
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
  const btnViewSubmitted = document.getElementById("btn-view-submitted-recordings");

  if (finishedTitle) {
    finishedTitle.textContent = "Test Session Completed & Locked";
  }

  if (finishedDesc) {
    const completedDate = sessionData.completedAt 
      ? new Date(sessionData.completedAt).toLocaleString() 
      : "earlier";
    finishedDesc.innerHTML = `
      This test session was already completed and submitted on <strong>${completedDate}</strong>.<br>
      Your voice recordings have been saved and sent to your AI examiner for evaluation.
      To preserve the integrity of the test, this session cannot be restarted.
    `;
  }

  if (finishedMeta) {
    finishedMeta.textContent = "You can return to your chat with the model to view your feedback and TOEIC score breakdown.";
  }

  // Populate questionBlobs from server submissions so user can listen to submitted audio
  if (sessionData.submissions) {
    Object.values(sessionData.submissions).forEach((sub) => {
      questionBlobs[sub.questionNumber] = {
        blob: null,
        url: `/api/sessions/${sessionId}/recordings/${sub.audioFileName}`,
        duration: sub.durationSeconds,
        question: sessionData.questions.find((q) => q.questionNumber === sub.questionNumber)
      };
    });
  }

  if (btnViewSubmitted) {
    btnViewSubmitted.addEventListener("click", () => {
      viewFinished.style.display = "none";
      viewReview.style.display = "flex";
      renderReviewList();
      
      // Update submit button to read-only locked state
      btnSubmitEvaluation.disabled = true;
      btnSubmitEvaluation.textContent = "✅ Session Submitted & Locked";
      btnSubmitEvaluation.style.opacity = "0.7";
      btnSubmitEvaluation.style.cursor = "default";
    });
  }
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
let recordingStartTime = 0;

function startRecording(question) {
  recordedChunks = [];
  recordingStartTime = Date.now();
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
      const rawBlob = new Blob(recordedChunks, { type: mimeType });
      const elapsedMs = Math.max(1000, Date.now() - recordingStartTime);
      const durationSeconds = Math.round(elapsedMs / 1000);

      // Fix WebM seeking bug by injecting duration header into EBML container
      let finalBlob = rawBlob;
      if (typeof window.ysFixWebmDuration === "function") {
        try {
          finalBlob = await window.ysFixWebmDuration(rawBlob, elapsedMs);
        } catch (err) {
          console.warn("Could not patch WebM duration:", err);
        }
      }

      const audioUrl = URL.createObjectURL(finalBlob);

      questionBlobs[question.questionNumber] = {
        blob: finalBlob,
        url: audioUrl,
        duration: durationSeconds,
        question
      };

      // Upload recording immediately in background
      await uploadQuestionAudio(question.questionNumber, finalBlob, durationSeconds);

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

  const reviewTitle = document.getElementById("review-title");
  const reviewDesc = document.getElementById("review-desc");
  if (reviewTitle && sessionData.isDrill) {
    reviewTitle.textContent = "Drill Completed!";
  }
  if (reviewDesc && sessionData.isDrill) {
    reviewDesc.textContent =
      "You have recorded all selected drill questions. You can review and listen back to your voice samples before submitting to the evaluator.";
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

  sessionData.questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "review-card";
    card.id = `review-card-${q.questionNumber}`;

    const saved = questionBlobs[q.questionNumber];
    const url = saved ? saved.url : null;
    const durationSec = saved ? saved.duration : q.responseTimeSeconds;

    const conf = TYPE_CONFIG[q.questionType] || {
      badge: q.questionType,
      instructions: "Respond to the question prompt."
    };

    const promptText = q.promptText || "";
    const isLongPrompt = promptText.length > 85 || Boolean(q.contextData) || Boolean(q.imageUrl);
    const previewText = isLongPrompt && promptText.length > 85 
      ? promptText.substring(0, 85) + "..." 
      : promptText;

    card.innerHTML = `
      <div class="review-card-top">
        <div class="review-card-title">
          <span class="review-q-num">Question ${q.questionNumber}</span>
          <span class="badge badge-part">${conf.badge}</span>
        </div>
        <div class="review-card-meta">
          <span class="review-duration-tag">⏱️ ${durationSec}s recorded</span>
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

      <div class="review-playback-box">
        <div class="playback-label">
          <span>🎙️</span>
          <span>Playback Voice Recording:</span>
        </div>
        ${url 
          ? `<audio class="review-audio-player" controls preload="metadata" src="${url}"></audio>` 
          : `<span class="review-missing">No voice recording captured</span>`
        }
      </div>
    `;

    // Connect expand/collapse button
    if (isLongPrompt) {
      const expandBtn = card.querySelector(`.review-expand-btn`);
      const fullBox = card.querySelector(`#prompt-full-${q.questionNumber}`);
      const prevBox = card.querySelector(`#prompt-prev-${q.questionNumber}`);
      const icon = expandBtn.querySelector(".expand-icon");
      const label = expandBtn.querySelector(".expand-text");

      expandBtn.addEventListener("click", () => {
        const isExpanded = fullBox.classList.toggle("expanded");
        if (isExpanded) {
          prevBox.style.display = "none";
          icon.textContent = "▲";
          label.textContent = "Collapse question";
        } else {
          prevBox.style.display = "block";
          icon.textContent = "▼";
          label.textContent = "Show full question";
        }
      });
    }

    reviewList.appendChild(card);
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
