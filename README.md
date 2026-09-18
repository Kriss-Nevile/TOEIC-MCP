# TOEIC Trainer MCP Server

[![CI](https://github.com/Kriss-Nevile/TOEIC-Trainer/actions/workflows/ci.yml/badge.svg)](https://github.com/Kriss-Nevile/TOEIC-Trainer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Node Version](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org)

An open-source Model Context Protocol (MCP) server that enables AI agents to administer interactive TOEIC Speaking examinations, execute targeted drills, manage local audio response recordings, and perform rubric-based evaluations.

The server supports standard input/output (`stdio`) for local host environments (such as Claude Desktop, Antigravity IDE, and Cursor) as well as HTTP with Server-Sent Events (`SSE`) for remote or multi-agent deployments.

---

## Overview

Authentic TOEIC Speaking preparation requires spoken responses delivered under realistic exam time constraints. This server provides the infrastructure for AI models to orchestrate oral examinations:

- **Session Orchestration**: Models generate or select speaking questions and launch dedicated testing sessions. Sessions can encompass the complete 11-question exam or focus on specific question types through targeted drills.
- **Candidate Interface**: Candidates complete assessments in a dedicated local web interface featuring microphone verification, timed preparation and response intervals, and response review capabilities.
- **Local Audio Management**: Spoken responses are captured and written directly to the host filesystem within a designated storage directory, accompanied by session metadata.
- **Evaluation Infrastructure**: Pre-configured evaluation prompts guide models in assessing candidate recordings against official ETS criteria (pronunciation, intonation, grammatical accuracy, vocabulary breadth, and topic development) to project scaled scores (0–200, Levels 1–8).

---

## Available Capabilities

### Tools

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `launch_speaking_test` | `questions` (SpeakingQuestion[])<br>`selected_question_numbers?` (number[])<br>`session_title?` (string)<br>`output_directory?` (string)<br>`auto_open_browser?` (boolean) | Initializes an examination session and opens the local browser simulator. Accepts an array of question definitions, with optional filtering for targeted drills (e.g. practicing only Question 3 or Questions 1–2). Returns session metadata and local interface URL. |
| `get_test_submission` | `session_id` (string)<br>`destination_folder?` (string) | Inspects the storage location for a given session and returns submission status, audio file paths, recorded durations, and question metadata for model evaluation. |

### Prompts

| Prompt | Arguments | Description |
| :--- | :--- | :--- |
| `evaluate_speaking_test` | `session_id`, `candidate_audio_paths`, `overall_observations?`, `custom_rubric_notes?` | Generates an evaluation prompt structuring candidate analysis against official ETS scoring rubrics across all speaking item types. |
| `evaluate_question` | `question_payload`, `candidate_response`, `part_number?` | Generates a diagnostic prompt for distractor analysis, trap categorization (phonetic confusion, non-sequiturs, morphological traps, scope errors), and remediation. |
| `diagnose_weaknesses` | `session_summary`, `error_breakdown`, `target_score?` | Synthesizes performance data into a section-by-section vulnerability matrix with a structured study roadmap. |
| `generate_targeted_lesson` | `weakness_topic`, `target_part?`, `proficiency_level?` | Produces an educational mini-lesson with underlying rules, common pitfalls, and custom practice drills. |

---

## Configuration

Server behavior and default paths are configured via `toeic.config.json` in the root directory:

```json
{
  "audioStorageDir": "./recordings",
  "webServerPort": 3210,
  "autoOpenBrowser": true,
  "httpTransportPort": 3001
}
```

- **`audioStorageDir`**: Target directory where session audio files and metadata are written.
- **`webServerPort`**: Port assigned to the local web simulator.
- **`autoOpenBrowser`**: Controls whether the default web browser is launched automatically upon session creation.
- **`httpTransportPort`**: Default listening port when the server is executed in HTTP mode.

---

## Installation and Client Setup

### Local Installation

```bash
git clone https://github.com/Kriss-Nevile/TOEIC-Trainer.git
cd TOEIC-Trainer
npm install
npm run build
npm link
```

### Client Configuration

#### Claude Desktop

Add the server definition to `claude_desktop_config.json`:

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

#### Antigravity IDE / Cursor

Add the entry to `mcp_config.json`:

```json
{
  "mcpServers": {
    "toeic-trainer": {
      "command": "node",
      "args": [
        "<PATH_TO_REPOSITORY>/dist/index.js",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

#### HTTP / SSE Mode

For network access or containerized deployments:

```bash
toeic-trainer --transport http --port 3001
```

Exposed endpoints:
- `GET /sse`: Server-Sent Events stream for persistent client sessions.
- `POST /messages`: JSON-RPC request handler.
- `GET /health`: Readiness and service status endpoint.

---

## Browser Simulation Environment

The simulation environment provides candidates with an authentic exam setting:

- **Input Calibration**: Live audio meters allow verification of microphone input before testing begins.
- **Standardized Timing**: Preparation and response countdowns adhere to ETS item timings, accompanied by acoustic signals.
- **Playback Review**: Recorded responses can be reviewed with seek capability prior to submitting.
- **Drill Display**: Visual indicators designate full-length mock examinations versus focused skill drills.
- **State Finalization**: Completed sessions are locked against re-recording to preserve evaluation integrity.

---

## Roadmap

Planned capabilities under active consideration:

- **Listening and Reading Simulator**: Implementation of Parts 1 through 7 with calibrated raw-to-scaled score conversion (5–495).
- **Curated Question Bank**: Pre-seeded business English question repositories with verified distractors and transcripts.
- **Automated Transcription**: Optional speech-to-text integration for automated phoneme and vocabulary analysis.
- **Adaptive Question Selection**: Dynamic session difficulty scaling governed by candidate historical performance.

---

## Contributing

Contributions are welcome. Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for architectural documentation, testing workflows, and MCP protocol compliance guidelines (including standard stream discipline and structured error formats).

```bash
npm test
npm run typecheck
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*TOEIC® is a registered trademark of Educational Testing Service (ETS). This project is an independent educational tool and is not affiliated with or endorsed by ETS.*
