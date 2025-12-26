/**
 * API client for the Knowledge Base backend
 */

import { API_BASE_URL } from "./config.js";
import type {
  QueryRequest,
  QueryResponse,
  ListIndexesResponse,
  HealthResponse,
} from "./types.js";

interface ErrorDetail {
  detail?: string;
  message?: string;
}

/**
 * Helper to handle API responses
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ detail: "Unknown error" }))) as ErrorDetail;
    throw new Error(error.detail || error.message || `HTTP error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return handleResponse<HealthResponse>(response);
}

/**
 * List all available indexes
 */
export async function listIndexes(): Promise<ListIndexesResponse> {
  const response = await fetch(`${API_BASE_URL}/indexes`);
  return handleResponse<ListIndexesResponse>(response);
}

/**
 * Perform a semantic search query
 */
export async function queryKnowledgeBase(request: QueryRequest): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<QueryResponse>(response);
}
