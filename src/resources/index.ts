import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  VISUAL_QUESTIONS_RESOURCE_URI,
  VISUAL_QUESTIONS_GUIDE_TEXT,
} from "./visual-questions.js";

export function registerResources(server: McpServer): void {
  server.resource(
    "visual_questions_guide",
    VISUAL_QUESTIONS_RESOURCE_URI,
    {
      description:
        "Official guide and curated photograph repository for sourcing authentic photographs for TOEIC visual questions (Speaking Q3-4, Writing Q1-5). Includes 'decent' picture criteria, web search query recipes, and pre-approved direct CDN image URLs.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: VISUAL_QUESTIONS_GUIDE_TEXT,
          },
        ],
      };
    }
  );
}
