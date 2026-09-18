# Contributing to TOEIC Trainer MCP Server

This document outlines the architectural conventions, protocol requirements, and development workflow for contributing to the TOEIC Trainer MCP Server.

---

## Project Structure

```
toeic-trainer-mcp/
├── src/
│   ├── index.ts               # CLI Entrypoint (transport router: stdio vs http)
│   ├── server.ts              # Core McpServer initialization and registration
│   ├── transports/            # stdio and HTTP/SSE transport adapters
│   ├── domain/                # Session store and data models (Zod schemas)
│   ├── tools/                 # MCP Tools (launch_speaking_test, get_test_submission)
│   ├── prompts/               # MCP Prompts (evaluate_speaking, diagnose_weaknesses, etc.)
│   ├── config/                # toeic.config.json parser and path resolver
│   └── web/                   # Local Express server and browser simulation interface
│       └── public/            # Client assets (HTML, CSS, audio scripts)
├── tests/                     # Unit and integration test suite
└── toeic.config.json          # Server configuration defaults
```

---

## Development Environment

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS)
- **npm**: `v9.x` or higher
- An MCP-compatible agent environment or test harness (e.g. Antigravity Agent, Codex/CLI agent runtimes, or custom agent frameworks)

### Repository Setup
```bash
git clone https://github.com/Kriss-Nevile/TOEIC-Trainer.git
cd TOEIC-Trainer
npm install
npm run build
```

### Local Execution Modes
- **Standard I/O Mode (local agent integration)**:
  ```bash
  npm run dev:stdio
  ```
- **HTTP / SSE Mode (remote access and multi-agent setups)**:
  ```bash
  npm run dev:http
  ```
  Health and readiness status is accessible at `http://localhost:3001/health`.

### Quality Verification Commands
```bash
# Type checking
npm run typecheck

# Automated test execution
npm test

# Production build and asset bundling
npm run build
```

---

## Architectural and Protocol Standards

Contributions must comply with the following technical requirements:

### Standard I/O Stream Isolation
When executing under `stdio` transport mode, `process.stdout` is strictly reserved for JSON-RPC 2.0 frames.
- Standard application logging must never route to `stdout`.
- Diagnostic output, warnings, and error messages must target `stderr` (`console.error`).

### Standardized Error Payloads
MCP tool handlers must avoid raising unhandled process exceptions. Operational and validation failures should return structured MCP error responses:

```typescript
return {
  isError: true,
  content: [
    {
      type: "text",
      text: "Descriptive error message detailing the reason for failure.",
    },
  ],
};
```

### Schema Validation
Tool inputs and prompt parameters must be validated using Zod schemas. Each field definition should include informative `.describe()` annotations to provide clear semantic context for calling language models.

### Simulator Assets and Build Synchronization
The simulation interface in `src/web/public/` utilizes native Web APIs and CSS without framework dependencies. When changes are made to frontend assets, `npm run build` must be executed to ensure the assets are synchronized to `dist/web/public/`.

---

## Contribution Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/feature-name
   ```
2. Implement changes accompanied by relevant unit or integration tests under `tests/`.
3. Verify that all automated checks succeed locally:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
4. Submit a Pull Request documenting the changes and completing the checklist in `.github/pull_request_template.md`.
