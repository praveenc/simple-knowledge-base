/**
 * Configuration for the Simple Knowledge Base MCP Server
 */

export const APP_NAME = "simple-kb-mcp-server";
export const APP_VERSION = "0.1.0";

// Backend API configuration
export const API_BASE_URL = process.env.KB_API_URL || "http://localhost:8000";
