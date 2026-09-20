import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";

export const SERVER_INSTRUCTIONS = `TOEIC Trainer MCP Server enables AI agents to administer authentic TOEIC Speaking and Writing mock exams and targeted drills.

IMPORTANT GUIDELINES FOR IMAGE-BASED QUESTIONS:
When drafting questions with visual media (TOEIC Speaking Q3–4: "Describe a Picture", TOEIC Writing Q1–5: "Write a Sentence Based on a Picture"):
1. INTERNET SEARCH FIRST: You must search the internet for authentic, high-quality photographs depicting realistic business, workplace, retail, or transit scenarios. Use direct HTTPS image links (e.g. Unsplash, Wikimedia Commons, Pexels direct CDN links).
2. "DECENT" PICTURE CRITERIA: Ensure the photo depicts authentic workplace settings with discernible people performing clear actions across distinct foreground/background planes.
3. CURATED RESOURCE: You may read the MCP resource 'toeic://guides/visual-questions' at any time to access search recipes and a pre-approved pool of direct image URLs.
4. STRICT LAST-RESORT SVG FALLBACK: Do NOT default to generating raw inline SVG data URIs. Inline SVGs are strictly permitted ONLY when offline or when a diligent web search yields zero usable pictures. Primitive stick figures and empty labeled boxes are strictly prohibited.`;

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "toeic-trainer-mcp",
      version: "1.0.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  registerTools(server);
  registerPrompts(server);
  registerResources(server);

  return server;
}

