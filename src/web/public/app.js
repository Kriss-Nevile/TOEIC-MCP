import { playStartBeep, playChime } from "./sounds.js";
import { WavAudioRecorder } from "./wav-recorder.js";

// App State
let sessionId = null;
let sessionData = null;
let isWritingTest = false;
let isCombinedTest = false;
let isWritingPhase = false;
let currentQuestionIndex = 0;
let mediaStream = null;
let wavRecorder = null;
let activeRerecord = null;
let questionBlobs = {}; // questionNumber -> { blob, url, duration, question }
let writtenAnswers = {}; // questionNumber -> { text, durationSeconds, question }
let cheatModeActive = false;

// Writing Part State
let writingParts = [];
let currentPartIndex = 0;
let currentPartQuestionIndex = 0;

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

const sectionTransitionModal = document.getElementById("section-transition-modal");
const btnBeginWritingSection = document.getElementById("btn-begin-writing-section");

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
const speakingNavHeader = document.getElementById("speaking-nav-header");
const timerCard = document.getElementById("timer-card");
const timerPhaseText = document.getElementById("timer-phase-text");
const timerDisplay = document.getElementById("timer-display");
const timerProgressBar = document.getElementById("timer-progress-bar");

// Writing Part Navigation Elements
const partNavContainer = document.getElementById("part-nav-container");
const partBadge = document.getElementById("part-badge");
const partTitleText = document.getElementById("part-title-text");
const btnToggleDirections = document.getElementById("btn-toggle-directions");
const partDirectionsPanel = document.getElementById("part-directions-panel");
const directionsHeading = document.getElementById("directions-heading");
const partTimeNote = document.getElementById("part-time-note");
const partDirectionsList = document.getElementById("part-directions-list");
const partQuestionTabs = document.getElementById("part-question-tabs");
const btnPrevQuestion = document.getElementById("btn-prev-question");
const btnFinishPart = document.getElementById("btn-finish-part");

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

function buildWritingPartsClient(questions) {
  const parts = [];

  // Part 1: Write a Sentence Based on a Picture (write_sentence)
  const part1Questions = questions.filter((q) => q.questionType === "write_sentence");
  if (part1Questions.length > 0) {
    const part1Time = part1Questions.length >= 5 ? 480 : Math.max(120, Math.round(part1Questions.length * 96));
    parts.push({
      partNumber: 1,
      partType: "write_sentence",
      title: "Part 1: Write a Sentence Based on a Picture",
      taskDescription: "Write ONE sentence based on the picture using both given words/phrases correctly.",
      directions: [
        "You will see a picture along with two words or phrases that must be used in your sentence.",
        "You may change the form of the words and arrange them in any order to create a complete sentence.",
      ],
      timeSeconds: part1Time,
      questions: part1Questions,
    });
  }

  // Part 2: Respond to a Written Request (respond_request)
  const part2Questions = questions.filter((q) => q.questionType === "respond_request");
  if (part2Questions.length > 0) {
    parts.push({
      partNumber: 2,
      partType: "respond_request",
      title: "Part 2: Respond to a Written Request",
      taskDescription: "Read the email or written memo below and write a comprehensive professional response.",
      directions: [
        "This part assesses your ability to respond to written requests in an email format.",
        "You have 10 minutes to read and write a response to each email.",
      ],
      timeSeconds: part2Questions.length * 600,
      questions: part2Questions,
    });
  }

  // Part 3: Write an Opinion Essay (write_opinion)
  const part3Questions = questions.filter((q) => q.questionType === "write_opinion");
  if (part3Questions.length > 0) {
    parts.push({
      partNumber: 3,
      partType: "write_opinion",
      title: "Part 3: Write an Opinion Essay",
      taskDescription: "State, explain, and support your opinion on the topic below. Aim for at least 300 words.",
      directions: [
        "Write an essay expressing your opinion on a specific topic.",
        "Your essay should present well-developed arguments, clear explanations, and relevant examples to support your opinion.",
        "An effective essay is typically at least 300 words long.",
      ],
      timeSeconds: part3Questions.length * 1800,
      questions: part3Questions,
    });
  }

  return parts;
}

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

    isCombinedTest = Boolean(sessionData.testType === "speaking_and_writing" || sessionId.startsWith("toeic_"));
    isWritingTest = Boolean(!isCombinedTest && (sessionData.testType === "writing" || sessionId.startsWith("wrt_")));

    // Adapt Branding and Page Headers
    if (isCombinedTest) {
      document.title = "TOEIC Speaking & Writing Simulator";
      if (brandIcon) brandIcon.textContent = "🎙️✍️";
      if (brandTitle) brandTitle.textContent = "TOEIC Speaking & Writing Simulator";
      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Review Saved Responses & Audio";
      }
      const writingQList = sessionData.writingQuestions || sessionData.questions.filter((q) => ["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));
      writingParts = sessionData.writingParts && sessionData.writingParts.length > 0
        ? sessionData.writingParts
        : buildWritingPartsClient(writingQList);
    } else if (isWritingTest) {
      document.title = "TOEIC Writing Test Simulator";
      if (brandIcon) brandIcon.textContent = "✍️";
      if (brandTitle) brandTitle.textContent = "TOEIC Writing Simulator";
      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Review Saved Responses";
      }
      writingParts = sessionData.parts && sessionData.parts.length > 0
        ? sessionData.parts
        : buildWritingPartsClient(sessionData.questions);
    } else {
      document.title = "TOEIC Speaking Test Simulator";
      if (brandIcon) brandIcon.textContent = "🎙️";
      if (brandTitle) brandTitle.textContent = "TOEIC Speaking Simulator";
      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Listen to Saved Audio";
      }
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
    if (isCombinedTest) {
      if (setupTitle) {
        setupTitle.textContent = sessionData.title || (sessionData.isDrill ? "Targeted Speaking & Writing Drill" : "Full TOEIC Speaking & Writing Mock Test");
      }
      if (setupDesc) {
        setupDesc.textContent =
          "Welcome to the complete TOEIC Speaking & Writing Test simulation. You will complete the oral Speaking section first, followed by the Writing section.";
      }
      if (setupMicBox) setupMicBox.style.display = "flex";
      if (setupWritingBox) setupWritingBox.style.display = "flex";

      if (btnStartExam) {
        btnStartExam.disabled = true;
        btnStartExam.textContent = "Start Speaking & Writing Test";
      }
    } else if (isWritingTest) {
      if (setupTitle) {
        setupTitle.textContent = sessionData.title || (sessionData.isDrill ? "Targeted Writing Drill" : "Full Writing Mock Test");
      }
      if (setupDesc) {
        setupDesc.textContent =
          "Welcome to the TOEIC Writing Test simulation. Review the exam guidelines and part breakdown below before beginning your test.";
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

    if (setupExamSummary) {
      if (isCombinedTest) {
        const spkList = sessionData.speakingQuestions || sessionData.questions.filter((q) => !["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));
        const wrtList = sessionData.writingQuestions || sessionData.questions.filter((q) => ["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));
        const wrtMin = Math.ceil(writingParts.reduce((acc, p) => acc + p.timeSeconds, 0) / 60);
        setupExamSummary.innerHTML = `
          <strong>${sessionData.title || "TOEIC Speaking & Writing Mock Test"}</strong><br>
          • <strong>Speaking Section:</strong> ${spkList.length} Questions (~20 minutes)<br>
          • <strong>Writing Section:</strong> ${wrtList.length} Questions across ${writingParts.length} Parts (~${wrtMin} minutes)<br>
          <span style="display:inline-block; margin-top:0.5rem; color: #a5b4fc; font-weight: 600;">
            Complete Speaking first, followed immediately by Writing.
          </span>
        `;
      } else if (isWritingTest) {
        const partsSummary = writingParts.map((p) => {
          const mins = Math.ceil(p.timeSeconds / 60);
          return `• <strong>${p.title}:</strong> ${p.questions.length} question${p.questions.length > 1 ? "s" : ""} (${mins} min${mins !== 1 ? "s" : ""} total)`;
        }).join("<br>");
        const totalMin = Math.ceil(writingParts.reduce((acc, p) => acc + p.timeSeconds, 0) / 60);

        setupExamSummary.innerHTML = `
          <strong>${sessionData.title || "TOEIC Writing Test"}</strong><br>
          ${partsSummary}<br>
          <span style="display:inline-block; margin-top:0.5rem; color: #a5b4fc; font-weight: 600;">
            Total allocated duration: ~${totalMin} minutes across ${writingParts.length} Part${writingParts.length > 1 ? "s" : ""}.
          </span>
        `;
      } else {
        const durationTotalSec = sessionData.questions.reduce(
          (acc, q) => acc + (q.prepTimeSeconds || 0) + (q.responseTimeSeconds || 45),
          0
        );
        const durationMin = Math.ceil(durationTotalSec / 60);
        setupExamSummary.innerHTML = `
          <strong>${sessionData.title || "TOEIC Speaking Test"}</strong><br>
          Questions: ${sessionData.questions.map(q => `Q${q.questionNumber}`).join(", ")} (${sessionData.questions.length} total)<br>
          Total allocated duration: ~${durationMin} minute${durationMin !== 1 ? "s" : ""}.
        `;
      }
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
    finishedTitle.textContent = isCombinedTest
      ? "Speaking & Writing Test Completed & Locked"
      : (isWritingTest ? "Writing Test Completed & Locked" : "Test Session Completed & Locked");
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
    finishedMeta.textContent = isCombinedTest
      ? "Return to your chat and ask your AI agent to generate your Speaking & Writing rubric evaluation."
      : (isWritingTest
        ? "Return to your chat and ask your AI agent to generate your rubric evaluation."
        : "Return to your chat and ask your AI agent to generate your evaluation.");
  }

  if (btnViewSubmitted) {
    btnViewSubmitted.textContent = isCombinedTest
      ? "Review Saved Responses & Audio"
      : (isWritingTest ? "Review Saved Responses" : "Listen to Saved Audio");
  }

  // Populate state from server submissions
  if (sessionData.submissions) {
    Object.values(sessionData.submissions).forEach((sub) => {
      const q = sessionData.questions.find((item) => item.questionNumber === sub.questionNumber);
      if (sub.audioFileName) {
        questionBlobs[sub.questionNumber] = {
          blob: null,
          url: `/api/sessions/${sessionId}/recordings/${sub.audioFileName}`,
          duration: sub.durationSeconds,
          question: q
        };
      }
      if (sub.writtenText !== undefined) {
        writtenAnswers[sub.questionNumber] = {
          text: sub.writtenText || "",
          durationSeconds: sub.durationSeconds || 0,
          question: q
        };
      }
    });
  }
}

function openSubmittedReview() {
  viewFinished.style.display = "none";
  viewReview.style.display = "flex";

  if (reviewTitle) {
    reviewTitle.textContent = isCombinedTest
      ? "Saved Speaking & Writing Submissions"
      : (isWritingTest ? "Saved Written Responses" : "Recorded Voice Samples");
  }
  if (reviewDesc) {
    reviewDesc.textContent = isCombinedTest
      ? "Review the voice recordings and written text responses saved locally for this test session."
      : (isWritingTest
        ? "Review the written text responses saved locally for this test session."
        : "Listen back to the voice recordings saved locally for this test session.");
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
        reviewDesc.textContent = isCombinedTest
          ? "Cheat Mode Active: Re-recording and response editing unlocked! You can now re-record audio or edit written responses before saving."
          : (isWritingTest
            ? "Cheat Mode Active: Response editing unlocked! You can now edit any written response before saving."
            : "Cheat Mode Active: Re-recording options unlocked! You can now re-record any question before saving.");
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

  if (btnPrevQuestion) {
    btnPrevQuestion.addEventListener("click", handlePrevQuestionClick);
  }

  if (btnNextQuestion) {
    btnNextQuestion.addEventListener("click", handleNextQuestionClick);
  }

  if (btnFinishPart) {
    btnFinishPart.addEventListener("click", handleFinishPartClick);
  }

  if (btnToggleDirections) {
    btnToggleDirections.addEventListener("click", toggleDirections);
  }

  if (btnBeginWritingSection) {
    btnBeginWritingSection.addEventListener("click", handleBeginWritingSection);
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

  if (isWritingTest) {
    isWritingPhase = true;
    if (speakingNavHeader) speakingNavHeader.style.display = "none";
    if (partNavContainer) partNavContainer.style.display = "flex";
    if (micActivityCard) micActivityCard.style.display = "none";
    if (writingInputCard) writingInputCard.style.display = "flex";
    if (writingTextarea) writingTextarea.value = "";
    writtenAnswers = {};
    currentPartIndex = 0;
    currentPartQuestionIndex = 0;
    startWritingPart(0);
  } else {
    // Speaking test or Combined test starts with Speaking
    isWritingPhase = false;
    if (speakingNavHeader) speakingNavHeader.style.display = "flex";
    if (partNavContainer) partNavContainer.style.display = "none";
    if (micActivityCard) micActivityCard.style.display = "flex";
    if (writingInputCard) writingInputCard.style.display = "none";
    currentQuestionIndex = 0;
    loadCurrentQuestion();
  }
}

function isInWritingMode() {
  return isWritingTest || isWritingPhase;
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

  // Update in-memory answer immediately so switching questions/tabs retains text
  if (isInWritingMode() && writingParts[currentPartIndex]) {
    const currentQ = writingParts[currentPartIndex].questions[currentPartQuestionIndex];
    if (currentQ) {
      if (!writtenAnswers[currentQ.questionNumber]) {
        writtenAnswers[currentQ.questionNumber] = { text: "", durationSeconds: 0, question: currentQ };
      }
      writtenAnswers[currentQ.questionNumber].text = text;

      // Update current tab has-answer state
      if (partQuestionTabs) {
        const activeTab = partQuestionTabs.children[currentPartQuestionIndex];
        if (activeTab) {
          if (text.trim().length > 0) {
            activeTab.classList.add("has-answer");
          } else {
            activeTab.classList.remove("has-answer");
          }
        }
      }
    }
  }
}

// Writing Part Flow
function renderPartQuestionTabs(part, activeIndex) {
  if (!partQuestionTabs) return;
  partQuestionTabs.innerHTML = "";

  part.questions.forEach((q, idx) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "q-tab";
    if (idx === activeIndex) tab.classList.add("active");

    const saved = writtenAnswers[q.questionNumber];
    const hasText = Boolean(saved && saved.text && saved.text.trim().length > 0);
    if (hasText) tab.classList.add("has-answer");

    tab.innerHTML = `
      <span class="q-tab-dot"></span>
      <span>Q${q.questionNumber}</span>
    `;

    tab.addEventListener("click", () => {
      if (idx !== currentPartQuestionIndex) {
        switchWritingQuestion(idx);
      }
    });

    partQuestionTabs.appendChild(tab);
  });
}

function startWritingPart(partIndex) {
  const part = writingParts[partIndex];
  if (!part) {
    finishExam();
    return;
  }

  // Clear textarea and counters before loading the new part
  if (writingTextarea) {
    writingTextarea.value = "";
  }
  if (writingWordCount) writingWordCount.textContent = "0 words";
  if (writingCharCount) writingCharCount.textContent = "0 chars";

  currentPartIndex = partIndex;
  currentPartQuestionIndex = 0;

  // Update Part Banner & Directions
  if (partNavContainer) partNavContainer.style.display = "flex";
  if (partBadge) partBadge.textContent = `PART ${part.partNumber}`;
  if (partTitleText) partTitleText.textContent = part.title;
  if (partTimeNote) {
    const mins = Math.floor(part.timeSeconds / 60);
    const secs = part.timeSeconds % 60;
    partTimeNote.textContent = `Allocated Time: ${mins} minute${mins !== 1 ? "s" : ""}${secs ? ` ${secs}s` : ""}`;
  }
  if (partDirectionsList) {
    partDirectionsList.innerHTML = part.directions
      .map((d) => `<li>${escapeHtml(d)}</li>`)
      .join("");
  }
  if (partDirectionsPanel) {
    partDirectionsPanel.style.display = "none";
  }

  // Set Part Timer
  currentPhase = "write";
  totalPhaseTime = part.timeSeconds;
  timeLeft = totalPhaseTime;

  timerCard.className = "card timer-card mode-speak";
  timerPhaseText.textContent = `PART ${part.partNumber}: WRITING TIME`;
  updateTimerDisplay();

  playStartBeep();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      saveCurrentWritingAnswer();
      if (writingTextarea) {
        writingTextarea.value = "";
      }
      playChime();
      advanceToNextPart();
    }
  }, 1000);

  loadWritingPartQuestion(0);
}

function switchWritingQuestion(newQIndex) {
  if (newQIndex === currentPartQuestionIndex) return;
  saveCurrentWritingAnswer();
  if (writingTextarea) {
    writingTextarea.value = "";
  }
  loadWritingPartQuestion(newQIndex);
}

function loadWritingPartQuestion(qIndex) {
  currentPartQuestionIndex = qIndex;
  const part = writingParts[currentPartIndex];
  if (!part) return;

  const question = part.questions[qIndex];
  if (!question) return;

  // Clear textarea first so stale text never flickers or carries over
  if (writingTextarea) {
    writingTextarea.value = "";
  }

  // Update prompt instructions & passage
  promptInstructions.textContent = part.taskDescription || "Respond to the question prompt.";
  promptPassage.textContent = question.promptText || "";

  // Handle image prompt
  if (question.imageUrl) {
    promptImage.style.display = "block";
    promptImage.onerror = () => {
      promptImage.style.display = "none";
      let errNotice = promptMedia.querySelector(".image-load-error");
      if (!errNotice) {
        errNotice = document.createElement("div");
        errNotice.className = "image-load-error";
        errNotice.style.padding = "16px";
        errNotice.style.textAlign = "center";
        errNotice.style.color = "#94a3b8";
        errNotice.style.fontSize = "0.9rem";
        errNotice.style.backgroundColor = "rgba(148, 163, 184, 0.08)";
        errNotice.style.borderRadius = "8px";
        errNotice.style.width = "100%";
        promptMedia.appendChild(errNotice);
      }
      errNotice.innerHTML = `⚠️ <em>Unable to load image from remote URL:</em> <br><span style="word-break:break-all; font-family:monospace; font-size:0.8rem; color:#cbd5e1;">${escapeHtml(question.imageUrl)}</span>`;
      errNotice.style.display = "block";
    };
    const existingNotice = promptMedia.querySelector(".image-load-error");
    if (existingNotice) existingNotice.style.display = "none";

    promptImage.src = question.imageUrl;
    promptMedia.style.display = "flex";
  } else {
    promptMedia.style.display = "none";
  }

  // Context data (keywords for Part 1 or email text for Part 2)
  if (question.contextData) {
    promptContext.textContent = question.contextData;
    promptContext.style.display = "block";
  } else {
    promptContext.style.display = "none";
  }

  // Restore textarea only if this question has a previously saved answer
  const savedAnswer = writtenAnswers[question.questionNumber];
  if (writingTextarea) {
    writingTextarea.value = (savedAnswer && typeof savedAnswer.text === "string") ? savedAnswer.text : "";
  }
  updateWritingLiveStats();

  if (question.minWords && question.minWords > 0) {
    if (writingTargetCount) {
      writingTargetCount.style.display = "inline-block";
      writingTargetCount.textContent = `Target: ${question.minWords}+ words`;
    }
  } else {
    if (writingTargetCount) writingTargetCount.style.display = "none";
  }

  // Render navigation tabs for this part
  renderPartQuestionTabs(part, qIndex);

  // Update navigation buttons inside part
  if (btnPrevQuestion) {
    btnPrevQuestion.style.display = qIndex > 0 ? "inline-flex" : "none";
  }
  if (btnNextQuestion) {
    btnNextQuestion.style.display = qIndex < part.questions.length - 1 ? "inline-flex" : "none";
  }
  if (btnFinishPart) {
    const isLastPart = currentPartIndex === writingParts.length - 1;
    btnFinishPart.textContent = isLastPart ? "Finish Test & Review →" : `Finish Part ${part.partNumber} →`;
  }

  if (writingTextarea) {
    writingTextarea.disabled = false;
    writingTextarea.focus();
  }
}

function saveCurrentWritingAnswer() {
  if (!isInWritingMode()) return;
  const part = writingParts[currentPartIndex];
  if (!part) return;
  const question = part.questions[currentPartQuestionIndex];
  if (!question) return;

  const text = writingTextarea ? writingTextarea.value : "";
  const duration = totalPhaseTime > 0 ? totalPhaseTime - Math.max(0, timeLeft) : 0;
  writtenAnswers[question.questionNumber] = {
    text,
    durationSeconds: duration,
    question,
  };
}

function handlePrevQuestionClick() {
  if (isInWritingMode()) {
    if (currentPartQuestionIndex > 0) {
      switchWritingQuestion(currentPartQuestionIndex - 1);
    }
  }
}

function handleNextQuestionClick() {
  if (isInWritingMode()) {
    const part = writingParts[currentPartIndex];
    if (part && currentPartQuestionIndex < part.questions.length - 1) {
      switchWritingQuestion(currentPartQuestionIndex + 1);
    }
  } else {
    // Speaking
    const speakingList = isCombinedTest
      ? (sessionData.speakingQuestions || sessionData.questions.filter((q) => !["write_sentence", "respond_request", "write_opinion"].includes(q.questionType)))
      : sessionData.questions;
    const question = speakingList[currentQuestionIndex];
    if (!question) return;

    clearInterval(timerInterval);
    playChime();

    currentQuestionIndex++;
    loadCurrentQuestion();
  }
}

function handleFinishPartClick() {
  if (!isInWritingMode()) return;
  saveCurrentWritingAnswer();

  const part = writingParts[currentPartIndex];
  if (!part) return;

  const unanswered = part.questions.filter(
    (q) => !writtenAnswers[q.questionNumber]?.text?.trim()
  );

  if (unanswered.length > 0) {
    const qList = unanswered.map((q) => `Q${q.questionNumber}`).join(", ");
    const confirmMsg = `You have ${unanswered.length} unanswered question${unanswered.length > 1 ? "s" : ""} (${qList}) in Part ${part.partNumber}.\n\nOnce you leave this part, you cannot return.\n\nDo you want to proceed?`;
    if (!confirm(confirmMsg)) {
      return;
    }
  }

  // Clear typing bar before transitioning to the next part
  if (writingTextarea) {
    writingTextarea.value = "";
  }

  playChime();
  advanceToNextPart();
}

function advanceToNextPart() {
  clearInterval(timerInterval);
  if (currentPartIndex < writingParts.length - 1) {
    startWritingPart(currentPartIndex + 1);
  } else {
    finishExam();
  }
}

function toggleDirections() {
  if (!partDirectionsPanel) return;
  const isHidden = partDirectionsPanel.style.display === "none";
  partDirectionsPanel.style.display = isHidden ? "block" : "none";
}

function transitionSpeakingToWritingSection() {
  clearInterval(timerInterval);
  playChime();

  if (sectionTransitionModal) {
    sectionTransitionModal.style.display = "flex";
  } else {
    handleBeginWritingSection();
  }
}

function handleBeginWritingSection() {
  if (sectionTransitionModal) {
    sectionTransitionModal.style.display = "none";
  }

  isWritingPhase = true;

  if (speakingNavHeader) speakingNavHeader.style.display = "none";
  if (partNavContainer) partNavContainer.style.display = "flex";
  if (micActivityCard) micActivityCard.style.display = "none";
  if (writingInputCard) writingInputCard.style.display = "flex";
  if (writingTextarea) writingTextarea.value = "";

  currentPartIndex = 0;
  currentPartQuestionIndex = 0;
  startWritingPart(0);
}

// Speaking Test Functions
function loadCurrentQuestion() {
  const speakingList = isCombinedTest
    ? (sessionData.speakingQuestions || sessionData.questions.filter((q) => !["write_sentence", "respond_request", "write_opinion"].includes(q.questionType)))
    : sessionData.questions;

  const question = speakingList[currentQuestionIndex];
  if (!question) {
    if (isCombinedTest) {
      transitionSpeakingToWritingSection();
    } else {
      finishExam();
    }
    return;
  }

  const currentItemNum = currentQuestionIndex + 1;
  const totalItems = speakingList.length;
  examQCounter.textContent = sessionData.isDrill
    ? (isCombinedTest ? `Speaking - Question ${question.questionNumber} (${currentItemNum} of ${totalItems})` : `Question ${question.questionNumber} (${currentItemNum} of ${totalItems} in drill)`)
    : (isCombinedTest ? `Speaking - Question ${question.questionNumber} of ${totalItems}` : `Question ${question.questionNumber} of ${totalItems}`);

  const conf = TYPE_CONFIG[question.questionType] || {
    badge: question.questionType,
    instructions: "Respond to the question prompt.",
  };
  examQType.textContent = conf.badge;
  promptInstructions.textContent = conf.instructions;

  promptPassage.textContent = question.promptText || "";

  if (question.imageUrl) {
    promptImage.style.display = "block";
    promptImage.onerror = () => {
      promptImage.style.display = "none";
      let errNotice = promptMedia.querySelector(".image-load-error");
      if (!errNotice) {
        errNotice = document.createElement("div");
        errNotice.className = "image-load-error";
        errNotice.style.padding = "16px";
        errNotice.style.textAlign = "center";
        errNotice.style.color = "#94a3b8";
        errNotice.style.fontSize = "0.9rem";
        errNotice.style.backgroundColor = "rgba(148, 163, 184, 0.08)";
        errNotice.style.borderRadius = "8px";
        errNotice.style.width = "100%";
        promptMedia.appendChild(errNotice);
      }
      errNotice.innerHTML = `⚠️ <em>Unable to load image from remote URL:</em> <br><span style="word-break:break-all; font-family:monospace; font-size:0.8rem; color:#cbd5e1;">${escapeHtml(question.imageUrl)}</span>`;
      errNotice.style.display = "block";
    };
    const existingNotice = promptMedia.querySelector(".image-load-error");
    if (existingNotice) existingNotice.style.display = "none";

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

  if (micActivityCard) micActivityCard.style.display = "flex";
  if (writingInputCard) writingInputCard.style.display = "none";
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
    reviewTitle.textContent = isCombinedTest
      ? "Review Your Speaking & Writing Submissions"
      : (isWritingTest ? "Review Your Written Responses" : "Review Your Recordings");
  }
  if (reviewDesc) {
    reviewDesc.textContent = isCombinedTest
      ? "Review your recorded voice answers and written responses below. When ready, click 'Save All Submissions' to persist everything to your local storage folder."
      : (isWritingTest
        ? "Review your written answers below. When ready, click 'Save All Responses' to persist your submission to disk."
        : "Listen back to your recorded answers in memory. When ready, click below to save everything to your storage folder.");
  }
  if (btnSubmitEvaluation) {
    btnSubmitEvaluation.textContent = isCombinedTest
      ? "Save All Submissions"
      : (isWritingTest ? "Save All Responses" : "Save All Recordings");
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

  if (isCombinedTest) {
    const spkList = sessionData.speakingQuestions || sessionData.questions.filter((q) => !["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));
    const wrtList = sessionData.writingQuestions || sessionData.questions.filter((q) => ["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));

    // Section 1 Header: Speaking
    const spkHeader = document.createElement("div");
    spkHeader.className = "review-section-header";
    spkHeader.innerHTML = `
      <span class="section-title">🎙️ Section 1: Speaking Test</span>
      <span class="section-count">${spkList.length} Questions Recorded</span>
    `;
    reviewList.appendChild(spkHeader);

    spkList.forEach((q) => {
      reviewList.appendChild(createSpeakingReviewCard(q, isCompleted));
    });

    // Section 2 Header: Writing
    const wrtHeader = document.createElement("div");
    wrtHeader.className = "review-section-header";
    wrtHeader.innerHTML = `
      <span class="section-title">✍️ Section 2: Writing Test</span>
      <span class="section-count">${wrtList.length} Questions across ${writingParts.length} Parts</span>
    `;
    reviewList.appendChild(wrtHeader);

    wrtList.forEach((q) => {
      reviewList.appendChild(createWritingReviewCard(q, isCompleted));
    });
  } else if (isWritingTest) {
    sessionData.questions.forEach((q) => {
      reviewList.appendChild(createWritingReviewCard(q, isCompleted));
    });
  } else {
    sessionData.questions.forEach((q) => {
      reviewList.appendChild(createSpeakingReviewCard(q, isCompleted));
    });
  }
}

function createSpeakingReviewCard(q, isCompleted) {
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
          ${q.imageUrl ? `<div class="review-image-block"><img src="${escapeHtml(q.imageUrl)}" alt="Question Visual" loading="lazy" /></div>` : ""}
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

  if (isLongPrompt) {
    attachPromptExpandHandler(card, q.questionNumber);
  }

  return card;
}

function createWritingReviewCard(q, isCompleted) {
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
          ${q.imageUrl ? `<div class="review-image-block"><img src="${escapeHtml(q.imageUrl)}" alt="Question Visual" loading="lazy" /></div>` : ""}
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

  if (isLongPrompt) {
    attachPromptExpandHandler(card, q.questionNumber);
  }

  return card;
}

function attachPromptExpandHandler(card, qNumber) {
  const expandBtn = card.querySelector(`.review-expand-btn`);
  const fullBox = card.querySelector(`#prompt-full-${qNumber}`);
  const prevBox = card.querySelector(`#prompt-prev-${qNumber}`);
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

  if (isCombinedTest) {
    btnSubmitEvaluation.textContent = "Saving Recordings & Responses...";

    try {
      const spkList = sessionData.speakingQuestions || sessionData.questions.filter((q) => !["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));
      const wrtList = sessionData.writingQuestions || sessionData.questions.filter((q) => ["write_sentence", "respond_request", "write_opinion"].includes(q.questionType));

      // 1. Upload audio recordings
      const entries = Object.entries(questionBlobs);
      const validEntries = entries.filter(([, item]) => item && item.blob);
      const totalAudio = validEntries.length;
      let audioSaved = 0;

      for (const [qNumStr, item] of validEntries) {
        audioSaved++;
        btnSubmitEvaluation.textContent = `Saving Audio (${audioSaved}/${totalAudio})...`;
        await uploadQuestionAudio(Number(qNumStr), item.blob, item.duration);
      }

      // 2. Upload writing responses
      let writingSaved = 0;
      for (const q of wrtList) {
        writingSaved++;
        btnSubmitEvaluation.textContent = `Saving Writing (${writingSaved}/${wrtList.length})...`;
        const item = writtenAnswers[q.questionNumber];
        const text = item ? item.text : "";
        const duration = item ? item.durationSeconds : 0;
        await uploadQuestionWriting(q.questionNumber, text, duration);
      }

      // 3. Mark session complete
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

      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Review Saved Responses & Audio";
      }

      const finishedTitle = document.getElementById("finished-title");
      const finishedDesc = document.getElementById("finished-desc");
      const finishedMeta = document.getElementById("finished-meta");
      if (finishedTitle) finishedTitle.textContent = "Test Completed & Saved";
      if (finishedDesc) finishedDesc.textContent = "All speaking audio recordings and written responses have been saved to your local storage folder.";
      if (finishedMeta) finishedMeta.textContent = "Return to your chat and ask your AI agent to evaluate your Speaking & Writing performance.";

      btnSubmitEvaluation.removeEventListener("click", saveAllResponsesOrRecordings);
      viewReview.style.display = "none";
      viewFinished.style.display = "block";
    } catch (err) {
      alert(`Save error: ${err.message}`);
      btnSubmitEvaluation.disabled = false;
      btnSubmitEvaluation.textContent = "Save All Submissions";
    }
  } else if (isWritingTest) {
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

      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Review Saved Responses";
      }

      const finishedTitle = document.getElementById("finished-title");
      const finishedDesc = document.getElementById("finished-desc");
      const finishedMeta = document.getElementById("finished-meta");
      if (finishedTitle) finishedTitle.textContent = "Responses Saved";
      if (finishedDesc) finishedDesc.textContent = "All written responses for this session have been saved to your local storage folder.";
      if (finishedMeta) finishedMeta.textContent = "Return to your chat and ask your AI agent to evaluate your responses.";

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
      if (btnViewSubmitted) {
        btnViewSubmitted.textContent = "Listen to Saved Audio";
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
