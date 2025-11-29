/**
 * API client for the Knowledge Base backend
 */

import type {
  CreateIndexRequest,
  CreateIndexResponse,
  EncodeBatchRequest,
  EncodeBatchResponse,
  EncodeDocRequest,
  EncodeDocResponse,
  HealthResponse,
  IndexRecordCountResponse,
  ListIndexesResponse,
  QueryRequest,
  QueryResponse,
  UploadDocResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Helper to handle API responses
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || error.message || `HTTP error: ${response.status}`);
  }
  return response.json();
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * Check backend health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return handleResponse<HealthResponse>(response);
}

// =============================================================================
// Index Management
// =============================================================================

/**
 * Create a new index
 */
export async function createIndex(request: CreateIndexRequest): Promise<CreateIndexResponse> {
  const response = await fetch(`${API_BASE_URL}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<CreateIndexResponse>(response);
}

/**
 * List all available indexes
 */
export async function listIndexes(): Promise<ListIndexesResponse> {
  const response = await fetch(`${API_BASE_URL}/indexes`);
  return handleResponse<ListIndexesResponse>(response);
}

/**
 * Get record count for an index
 */
export async function getIndexRecordCount(indexName: string): Promise<IndexRecordCountResponse> {
  const response = await fetch(`${API_BASE_URL}/indexes/${encodeURIComponent(indexName)}/count`);
  return handleResponse<IndexRecordCountResponse>(response);
}

// =============================================================================
// Document Encoding
// =============================================================================

/**
 * Encode a single document into an index
 */
export async function encodeDocument(request: EncodeDocRequest): Promise<EncodeDocResponse> {
  const response = await fetch(`${API_BASE_URL}/encode_doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<EncodeDocResponse>(response);
}

/**
 * Encode documents from a directory in batch
 */
export async function encodeBatch(request: EncodeBatchRequest): Promise<EncodeBatchResponse> {
  const response = await fetch(`${API_BASE_URL}/encode_batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<EncodeBatchResponse>(response);
}

/**
 * Upload and encode a document file
 */
export async function uploadDocument(file: File, indexName: string): Promise<UploadDocResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('index_name', indexName);

  const response = await fetch(`${API_BASE_URL}/upload_doc`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<UploadDocResponse>(response);
}

// =============================================================================
// Query
// =============================================================================

/**
 * Perform a semantic search query
 */
export async function queryKnowledgeBase(request: QueryRequest): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<QueryResponse>(response);
}
