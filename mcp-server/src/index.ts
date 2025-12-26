#!/usr/bin/env node
/**
 * Simple Knowledge Base MCP Server
 *
 * Provides semantic search capabilities over the knowledge base via MCP protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { APP_NAME, APP_VERSION, API_BASE_URL } from "./config.js";
import { kbSearchDocs, kbFetchDoc, kbListIndexes } from "./tools.js";
import { checkHealth } from "./api-client.js";

// Initialize MCP server
const server = new McpServer({
  name: APP_NAME,
  version: APP_VERSION,
});

// Register kb_list_indexes tool
server.registerTool(
  "kb_list_indexes",
  {
    description: "List all available indexes in the knowledge base. Use this to discover which indexes are available before searching.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await kbListIndexes();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Failed to list indexes",
              message: String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Register kb_search_docs tool
server.registerTool(
  "kb_search_docs",
  {
    description:
      "Search the knowledge base for relevant documents using semantic search. Returns ranked results with content snippets, relevance scores, and source document paths.",
    inputSchema: {
      query: z.string().describe("Natural language search query"),
      index_name: z.string().describe("Name of the index to search (use kb_list_indexes to see available indexes)"),
      top_k: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of results to return (default: 5)"),
    },
  },
  async ({ query, index_name, top_k }) => {
    try {
      const results = await kbSearchDocs(query, index_name, top_k ?? 5);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Search failed",
              message: String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Register kb_fetch_doc tool
server.registerTool(
  "kb_fetch_doc",
  {
    description:
      "Fetch chunks from a specific document in the knowledge base. Use this after kb_search_docs to get more content from a particular source document.",
    inputSchema: {
      index_name: z.string().describe("Name of the index containing the document"),
      source_document: z
        .string()
        .describe("Path or name of the source document (from kb_search_docs results)"),
      top_k: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of chunks to return (default: 10)"),
    },
  },
  async ({ index_name, source_document, top_k }) => {
    try {
      const result = await kbFetchDoc(index_name, source_document, top_k ?? 10);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Fetch failed",
              message: String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(`Starting ${APP_NAME} v${APP_VERSION}`);
  console.error(`Backend API: ${API_BASE_URL}`);

  // Check backend health
  try {
    await checkHealth();
    console.error("Backend connection: OK");
  } catch (error) {
    console.error("Backend connection: FAILED -", String(error));
    console.error("Warning: Server starting but backend may be unavailable");
  }

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Server running on stdio");
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
