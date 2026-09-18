import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { getSession, recordSubmission, updateSessionStatus } from "../domain/session-store.js";
import { loadConfig } from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage dynamically per session
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const sessionId = String(req.params.id);
    const session = getSession(sessionId);
    if (!session) {
      return cb(new Error(`Session not found: ${sessionId}`), "");
    }
    if (!fs.existsSync(session.recordingsDir)) {
      fs.mkdirSync(session.recordingsDir, { recursive: true });
    }
    cb(null, session.recordingsDir);
  },
  filename: (req, file, cb) => {
    const questionNumber = req.body.questionNumber || "unknown";
    const ext = path.extname(file.originalname) || (file.mimetype === "audio/wav" ? ".wav" : ".webm");
    cb(null, `q${questionNumber}${ext}`);
  }
});

const upload = multer({ storage });

export function createExpressApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static assets from src/web/public or dist/web/public
  let publicDir = path.resolve(__dirname, "public");
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(__dirname, "../../src/web/public");
  }
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Get session details
  app.get("/api/sessions/:id", (req, res) => {
    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  });

  // Serve audio recording files for review/playback
  app.get("/api/sessions/:id/recordings/:filename", (req, res) => {
    const sessionId = String(req.params.id);
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const filename = path.basename(String(req.params.filename));
    const filePath = path.join(session.recordingsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Recording file not found" });
    }
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".wav": "audio/wav",
      ".webm": "audio/webm",
      ".weba": "audio/webm",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
    };
    res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
    res.sendFile(filePath);
  });

  // Upload question recording
  app.post(
    "/api/sessions/:id/recordings",
    upload.single("audio"),
    (req, res) => {
      const sessionId = String(req.params.id);
      const session = getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Prevent retakes and overwrite if session is already completed
      if (session.status === "completed") {
        return res.status(403).json({ error: "Session has already been submitted and is locked." });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No audio file provided in upload" });
      }

      const questionNumber = Number(req.body.questionNumber);
      const durationSeconds = Number(req.body.durationSeconds) || 0;
      const question = session.questions.find((q) => q.questionNumber === questionNumber);

      const submission = {
        questionNumber,
        questionType: question?.questionType || "read_aloud",
        promptText: question?.promptText || "",
        audioFileName: file.filename,
        audioFilePath: file.path,
        fileSizeBytes: file.size,
        durationSeconds,
        uploadedAt: new Date().toISOString(),
      };

      recordSubmission(sessionId, submission);

      res.status(200).json({
        success: true,
        submission,
      });
    }
  );

  // Submit test session for final evaluation
  app.post("/api/sessions/:id/submit", (req, res) => {
    const sessionId = String(req.params.id);
    const session = updateSessionStatus(sessionId, "completed");

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.status(200).json({
      success: true,
      status: "completed",
      totalSubmissions: Object.keys(session.submissions).length,
      session,
    });
  });

  return app;
}

let activeServer: http.Server | null = null;
let currentPort: number | null = null;
const activeSockets = new Set<import("node:net").Socket>();

export async function startWebServer(
  desiredPort?: number
): Promise<{ app: express.Express; port: number; server: http.Server }> {
  if (activeServer && currentPort) {
    return { app: createExpressApp(), port: currentPort, server: activeServer };
  }

  const config = loadConfig();
  const port = desiredPort || config.webServerPort || 3210;
  const app = createExpressApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      activeServer = server;
      currentPort = port;
      server.unref(); // Crucial: background web server must not prevent Node from exiting cleanly

      server.on("connection", (socket) => {
        activeSockets.add(socket);
        socket.on("close", () => activeSockets.delete(socket));
      });

      console.error(`[Web Server] TOEIC Speaking Simulator UI running at http://localhost:${port}`);
      resolve({ app, port, server });
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Web Server] Port ${port} in use, trying port ${port + 1}...`);
        startWebServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

export function stopWebServer(): Promise<void> {
  return new Promise((resolve) => {
    for (const socket of activeSockets) {
      socket.destroy();
    }
    activeSockets.clear();

    if (activeServer) {
      activeServer.close(() => {
        activeServer = null;
        currentPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
