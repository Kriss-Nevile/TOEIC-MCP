# TOEIC Trainer MCP Server

An official **Model Context Protocol (MCP)** server providing tools and skills for AI models to simulate, train, and evaluate TOEIC (Test of English for International Communication) examinations over both **stdio** and **HTTP (SSE)** transports.

---

## 🎯 Key Features

- **Dual Transport Flexibility**:
  - `stdio`: Plug-and-play with local MCP hosts (Claude Desktop, Cursor, Antigravity IDE).
  - `HTTP / SSE`: Remote API and multi-session web integration with Server-Sent Events.
- **Realistic Exam Simulation**:
  - Supports full 200-question mock exams or focused part-by-part practice (Parts 1 to 7).
  - Accurate timing and section constraints (Listening: ~45 min, Reading: 75 min).
  - Calibrated ETS raw-to-scaled score conversion (5–495 per section, 10–990 total).
- **In-Depth Diagnostic & Evaluation Skills**:
  - Rubric-grounded evaluation for every question response.
  - Distractor trap classification (phonetic traps, non-sequiturs, word form confusions, scope traps).
  - CEFR / ETS competency skill breakdown and personalized remediation takeaways.
- **Adaptive Drills & Targeted Practice**:
  - On-demand generation and filtering of questions by difficulty, grammar rule, or business domain.

---

## 🏗️ Transports & Architecture

```
[ MCP Clients / Models ]
       │            │
       │ stdio      │ HTTP / SSE
       ▼            ▼
[ Stdio Adapter ] [ HTTP Server (/sse, /messages) ]
       └────────────┬────────────┘
                    ▼
          [ Core MCP Server ]
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
[ MCP Tools ]  [ Prompts ]   [ Resources ]
  - Simulation   - Rubric      - Question Bank
  - Drills       - Diagnosis   - Score Tables
  - Submissions  - Lessons     - Transcripts
```

---

## 📋 Available MCP Capabilities

### Tools
- `launch_speaking_test`: Launches a local browser app simulating a TOEIC Speaking test with questions drafted by the model. Voice recordings are saved to the configured destination folder.
- `get_test_submission`: Retrieves the recorded audio samples and submission status from the configured directory once the candidate submits.
- `start_test_session`: Initiate a full mock or modular practice session.
- `get_next_question`: Retrieve questions without answer keys.
- `submit_answer`: Record responses and receive timing feedback.
- `finish_test_session`: Compute scaled score, ETS band, and comprehensive breakdown.
- `get_session_status`: Check remaining time and answered question indices.
- `generate_drill`: Request targeted questions for a specific part or grammar area.
- `search_question_bank`: Query questions by grammar tag, keyword, or context.
- `get_audio_transcript`: Access spoken transcripts for listening questions.

### MCP Prompts
- `evaluate_speaking_test`: Rubric-grounded prompt for evaluating candidate voice recordings against official ETS TOEIC Speaking criteria (0–200 scaled score, Levels 1–8).
- `evaluate_question`: Prompts the model to perform deep distractor analysis, trap classification (phonetic, non-sequitur, word form, scope), and actionable remediation takeaways for any Part 1–7 question.
- `diagnose_weaknesses`: Synthesizes completed exam session results into a vulnerability matrix across parts, classifies error root causes, and generates a prioritized 3-phase study roadmap.
- `generate_targeted_lesson`: Generates focused mini-lessons with core grammar/vocabulary principles, ETS trap blueprints, authentic 3-question practice drills, and answer commentaries.

---

## ⚙️ Configuration (`toeic.config.json`)

Persistent settings can be configured in `toeic.config.json`:

```json
{
  "audioStorageDir": "./recordings",
  "webServerPort": 3210,
  "autoOpenBrowser": true,
  "httpTransportPort": 3001
}
```

- **`audioStorageDir`**: Target folder where voice recordings are saved (relative or absolute).
- **`webServerPort`**: Port for the local browser simulation web application.
- **`autoOpenBrowser`**: Automatically open the system default web browser when a test is launched.
- **`httpTransportPort`**: Default port for the HTTP/SSE MCP transport.

---

## 🚀 Quickstart & Client Setup

### Option A: Direct via `npx` (No Local Install Required)
Add this to your client's MCP configuration (e.g. `mcp_config.json`, Claude Desktop `claude_desktop_config.json`, or Cursor):

```json
{
  "mcpServers": {
    "toeic-trainer": {
      "command": "npx",
      "args": [
        "-y",
        "toeic-trainer-mcp",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

### Option B: Local Repository (Clone & Link)
If developing locally or cloning the repository:

1. Clone and build:
   ```bash
   git clone https://github.com/Kriss-Nevile/TOEIC-Trainer.git
   cd TOEIC-Trainer
   npm install
   npm run build
   npm link
   ```
2. Configure your MCP client:
   ```json
   {
     "mcpServers": {
       "toeic-trainer": {
         "command": "toeic-trainer",
         "args": ["--transport", "stdio"]
       }
     }
   }
   ```

### Option C: Remote HTTP / SSE Mode
```bash
# Start server with SSE transport
toeic-trainer --transport http --port 3001
# Or from local source:
node dist/index.js --transport http --port 3001
```

Endpoints exposed:
- `GET /sse`: Persistent Server-Sent Events stream.
- `POST /messages`: JSON-RPC message dispatcher.
- `GET /health`: Health and readiness probe.

---

## 📖 Context & Instructions for Agents

For complete developer specifications, domain models, schema requirements, and contributing guidelines, refer to [AGENTS.md](file:///c:/Users/Admin/Desktop/Projects/TOEIC%20Trainer/AGENTS.md).
