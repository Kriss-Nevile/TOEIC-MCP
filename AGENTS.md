# TOEIC Trainer MCP Server - Repository Instructions & Context

## 1. Project Overview & Mission

This repository contains a **Model Context Protocol (MCP)** server designed to simulate, train, and evaluate **TOEIC (Test of English for International Communication - Listening & Reading)** examinations. 

The server provides a standardized interface for AI models and autonomous agents to:
1. **Simulate full mock tests** and modular part-by-part drills under authentic exam constraints (timing, question structure, audio transcripts).
2. **Train interactive learners** via adaptive question selection, targeted grammar/vocabulary drills, and difficulty scaling.
3. **Execute deep, rubric-grounded evaluations** on question responses (distractor analysis, error classification, CEFR/ETS skill mapping, and scaled score projections).

---

## 2. Protocol & Transport Specifications

The MCP server must support **dual transport** operating modes seamlessly, sharing identical domain logic, tools, prompts, and resources:

```
                      ┌──────────────────────────────────────────────┐
                      │              MCP Client (Model)              │
                      └───────┬──────────────────────────────┬───────┘
                              │ stdio                        │ HTTP / SSE
                              ▼                              ▼
                 ┌─────────────────────────┐    ┌─────────────────────────┐
                 │    Stdio Transport      │    │     HTTP Transport      │
                 │   (Local CLI / IDE)     │    │   (SSE + POST Handler)  │
                 └────────────┬────────────┘    └────────────┬────────────┘
                              │                              │
                              └──────────────┬───────────────┘
                                             ▼
                               ┌───────────────────────────┐
                               │     Core Server Layer     │
                               │  (Tools, Prompts, State)  │
                               └─────────────┬─────────────┘
                                             ▼
                             ┌───────────────────────────────┐
                             │    TOEIC Domain & DB Store    │
                             │ (Questions, Tests, Evaluator) │
                             └───────────────────────────────┘
```

### 2.1. Stdio Transport
- **Target Audience**: Local LLM host interfaces (Claude Desktop, Antigravity IDE, Cursor, CLI runners).
- **Communication**: JSON-RPC 2.0 over `process.stdin` / `process.stdout` (or standard streams).
- **Standard**: Strictly silent on `stdout` (no non-MCP log output); all diagnostic logs must route to `stderr`.

### 2.2. HTTP Transport (SSE / Streamable HTTP)
- **Target Audience**: Remote agents, web applications, multi-user test environments, microservices.
- **Endpoints**:
  - `GET /sse`: Server-Sent Events endpoint establishing persistent client session and emitting endpoint URLs.
  - `POST /messages`: Handles incoming JSON-RPC client messages addressed to active sessions.
  - `GET /health`: Health-check route returning server readiness, uptime, and available tool/prompt counts.
- **Session Management**: Thread-safe or state-isolated session tracking keyed by `sessionId` to support concurrent test simulations.

---

## 3. TOEIC Domain Knowledge & Exam Architecture

Every tool, prompt, and question generator must conform strictly to the official **TOEIC Listening & Reading** format (200 questions, 2 hours total, 990 maximum scaled score):

### 3.1. Listening Comprehension (100 Questions, ~45 Minutes, 5–495 Scaled Score)
- **Part 1: Photographs** (6 questions): 1 image per question, 4 spoken descriptions ($A, B, C, D$). Evaluates spatial awareness, action description, and avoidance of phonetic traps.
- **Part 2: Question-Response** (25 questions): 1 prompt + 3 spoken responses ($A, B, C$). Evaluates direct and indirect conversational answers, tag questions, and WH-questions.
- **Part 3: Short Conversations** (39 questions / 13 dialogues $\times$ 3 questions): Dialogue between 2–3 speakers with context questions, speaker intent, and graphic/table references.
- **Part 4: Short Talks** (30 questions / 10 talks $\times$ 3 questions): Monologues (announcements, broadcasts, voice messages) with main idea, factual detail, and inference questions.

### 3.2. Reading Comprehension (100 Questions, 75 Minutes, 5–495 Scaled Score)
- **Part 5: Incomplete Sentences** (30 questions): Fill-in-the-blank sentences targeting parts of speech, verb tenses, voice, conjunctions, and vocabulary collocations.
- **Part 6: Text Completion** (16 questions / 4 passages $\times$ 4 questions): Articles, memos, letters, emails with 3 lexical/grammatical blanks + 1 sentence insertion blank.
- **Part 7: Reading Comprehension** (54 questions):
  - *Single Passages* (29 questions / ~10 passages)
  - *Multiple Passages* (25 questions / 2 double sets, 3 triple sets): Cross-referencing information between emails, invoices, schedules, and reviews.

### 3.3. Writing Test (8 Questions, ~60 Minutes, 0–200 Scaled Score, Levels 1–9)
- **Questions 1–5: Write a Sentence Based on a Picture** (1 image + 2 given words/phrases per question, ~8 minutes total): Evaluates grammatical correctness, accurate keyword usage in context, and factual relevance to the image (Scored 0–3 each).
- **Questions 6–7: Respond to a Written Request** (incoming business email/memo with 2–3 required tasks, 10 minutes per question): Evaluates task completion, organization, paragraph structure, business vocabulary, and syntactic variety (Scored 0–4 each).
- **Question 8: Write an Opinion Essay** (opinion prompt on an issue, 30 minutes, 300+ words recommended): Evaluates clear thesis statement, reasoned elaboration with concrete examples, cohesive discourse markers, and grammatical precision (Scored 0–5).

---

## 4. MCP Tools Specification

The server exposes tools categorized into **Oral & Written Exam Simulation**, **Interactive Training**, and **Progress Tracking**:

### 4.1. Simulation & Test Engine Tools
| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `launch_speaking_test` | `questions: SpeakingQuestion[]`, `selected_question_numbers?: number[]`, `session_title?: string`, `output_directory?: string`, `auto_open_browser?: boolean` | Initializes an oral examination session, starts web server, launches browser simulator, and records PCM WAV audio files. |
| `launch_writing_test` | `questions: WritingQuestion[]`, `selected_question_numbers?: number[]`, `session_title?: string`, `output_directory?: string`, `auto_open_browser?: boolean` | Initializes a written examination session, starts web server, launches distraction-free writing environment with real-time word counting, and saves `.txt` responses. |
| `launch_speaking_and_writing_test` | `speaking_questions: SpeakingQuestion[]`, `writing_questions: WritingQuestion[]`, `selected_speaking_question_numbers?: number[]`, `selected_writing_question_numbers?: number[]`, `session_title?: string`, `output_directory?: string`, `auto_open_browser?: boolean` | Initializes a combined examination session running Speaking first, then Writing with automatic transition, saving files into `<sessionDir>/recordings/` and `<sessionDir>/writing/`. |
| `get_test_submission` | `session_id: string`, `destination_folder?: string` | Inspects session folder and returns submission status, recorded audio paths (speaking) and/or written texts and word counts (writing) for model evaluation. |

---


## 5. Skills & Evaluation Mechanics

Models connecting to the server rely on specialized skills and prompt structures to evaluate candidate answers with pedagogical rigor:

### 5.1. Question-Level Evaluation Skill
Every evaluated question must be assessed across four dimensions:
1. **Correctness & Option Key**: Verification against the authoritative key.
2. **Distractor Taxonomy**:
   - *Phonetic Confusion / Sound-Alikes* (Listening Parts 1 & 2: e.g., "coffee" vs. "copy").
   - *Direct Response / Non-Sequitur Traps* (Listening Part 2: responding to a "When" question with a "Yes/No").
   - *Grammatical / Morphological Distractors* (Part 5: incorrect word forms like adjective vs. adverb, gerund vs. infinitive).
   - *Scope / False Detail Traps* (Part 7: extreme words, inverted facts, information mentioned in passage but irrelevant to the question).
3. **Skill Taxonomy & ETS Competency**:
   - Lexical Resource / Vocabulary (Business collocations, false friends).
   - Grammatical Accuracy (Subject-verb agreement, relative clauses, conditionals).
   - Discourse & Inference (Author intent, tone, context-dependent meaning).
4. **Actionable Remediation**: A concise takeaway rule explaining why the correct choice is required and how to spot the trap in future tests.

### 5.2. MCP Prompts & Prompt Templates
The server exposes the following pre-configured MCP prompts:
- `evaluate_speaking_test`: Accepts a completed speaking session ID, guiding the model through official ETS Speaking rubrics (Questions 1–11) to estimate scaled scores (0–200, Levels 1–8).
- `evaluate_writing_test`: Accepts a completed writing session ID, guiding the model through official ETS Writing rubrics (Questions 1–8: sentence accuracy, request fulfillment, essay thesis & development) to estimate scaled scores (0–200, Levels 1–9).
- `evaluate_question`: Accepts a question payload and candidate answer, prompting the model to perform distractor analysis and output structured educational feedback.
- `diagnose_weaknesses`: Accepts a completed session summary and outputs a diagnostic breakdown by Part and error types.
- `generate_targeted_lesson`: Produces a focused mini-lesson and customized exercise set based on the learner's most frequent error patterns.


### 5.3. Score Conversion & ETS Band Mapping
The scoring engine must implement a calibrated TOEIC conversion table:
- Raw Score: 0–100 for Listening, 0–100 for Reading.
- Scaled Score: Non-linear mapping to 5–495 per section (rounded to multiples of 5).
- Total Score: 10–990.
- Proficiency Level Mapping:
  - **10 – 250**: Elementary (CEFR A1)
  - **255 – 400**: Low Intermediate (CEFR A2)
  - **405 – 600**: Intermediate (CEFR B1)
  - **605 – 780**: High Intermediate (CEFR B2)
  - **785 – 900**: Advanced (CEFR C1)
  - **905 – 990**: Superior / Mastery (CEFR C1–C2)

---

## 6. Directory Structure & Architecture Guidelines

When building out the codebase, adhere to this modular structure:

```
toeic-trainer-mcp/
├── AGENTS.md                  # This file: Agent instructions and context
├── README.md                  # Project overview, installation, and quickstart
├── package.json (or pyproject.toml)
├── tsconfig.json
├── src/
│   ├── index.ts               # Entry point: Transport selector (CLI flags/env)
│   ├── transports/
│   │   ├── stdio.ts           # Stdio transport adapter
│   │   └── http.ts            # HTTP/SSE transport adapter (Express/Fastify)
│   ├── server.ts              # Core MCP server setup & handler registrations
│   ├── domain/
│   │   ├── toeic/
│   │   │   ├── types.ts       # Domain models (Question, ExamSession, Score)
│   │   │   ├── scorer.ts      # Raw-to-scaled score conversion logic
│   │   │   ├── parts.ts       # Part 1-7 rules, timing, and specifications
│   │   │   └── evaluator.ts   # Distractor analysis and rubric evaluation
│   │   └── session/
│   │       ├── manager.ts     # Active session state store (in-memory / SQLite)
│   │       └── timer.ts       # Exam countdown and time tracking
│   ├── tools/                 # MCP Tool handlers
│   │   ├── simulation.ts      # start_test, get_next_question, submit_answer
│   │   ├── training.ts        # generate_drill, search_question_bank
│   │   └── index.ts           # Tool definitions and schema registry
│   ├── prompts/               # MCP Prompt templates
│   │   ├── evaluation.ts      # Question evaluation prompts
│   │   ├── diagnosis.ts       # Exam diagnostic prompts
│   │   └── index.ts           # Prompt registry
│   ├── resources/             # MCP Resources (static question data, score tables)
│   │   └── index.ts           # Resource URIs (e.g., toeic://questions/{id})
│   └── data/
│       ├── questions/         # Seed questions for Parts 1 to 7
│       └── score_table.json   # Calibrated ETS raw-to-scaled conversion matrix
└── tests/
    ├── domain/                # Scorer, evaluator, and session tests
    ├── tools/                 # Tool input/output unit tests
    └── transports/            # stdio and SSE integration tests
```

---

## 7. Developer & Agent Implementation Guidelines

1. **Protocol Compliance**:
   - Always validate tool arguments using strict JSON Schema (Zod or Pydantic).
   - Ensure tool errors return standardized MCP `isError: true` responses with descriptive messages rather than unhandled process exceptions.
2. **Dual Transport Testing**:
   - Any tool added must be tested on both `stdio` and `http` transports.
   - For `stdio`, ensure standard input/output remains pristine JSON-RPC messages. Never invoke `console.log()` directly in application code—use a dedicated logger outputting to `stderr`.
   - For `http`, ensure CORS headers, content types, and SSE event streaming conform to standard MCP client specifications.
3. **Data Integrity & Question Realism**:
   - Synthetic or seeded TOEIC questions must accurately mirror real business English contexts (e.g., purchasing, supply chain, office memos, corporate travel, client invoices).
   - Avoid colloquialisms not typical of ETS examinations.
4. **State Isolation**:
   - Session states must be isolated. Multiple connected clients via HTTP should not overwrite each other's active exams or submitted answers.
