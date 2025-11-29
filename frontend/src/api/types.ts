/**
 * API types for the Knowledge Base backend
 */

// =============================================================================
// Common Types
// =============================================================================

export interface SearchResult {
  content: string;
  relevance_score: number;
  source_document: string;
  chunk_offset: number;
}

export interface HealthResponse {
  status: string;
  app: string;
}

// =============================================================================
// Index Management Types
// =============================================================================

export interface CreateIndexRequest {
  index_name: string;
}

export interface CreateIndexResponse {
  index_name: string;
  status: string;
  message: string;
}

export interface ListIndexesResponse {
  indexes: string[];
  count: number;
}

export interface IndexRecordCountResponse {
  index_name: string;
  record_count: number;
}

// =============================================================================
// Document Encoding Types
// =============================================================================

export interface EncodeDocRequest {
  document_path: string;
  index_name: string;
  metadata?: Record<string, unknown>;
}

export interface EncodeDocResponse {
  status: string;
  message: string;
  index_name: string;
  document_path?: string;
  chunk_count?: number;
  token_counts?: number[];
}

export interface EncodeBatchRequest {
  directory_path: string;
  index_name: string;
  file_patterns?: string[];
}

export interface EncodeBatchResponse {
  status: string;
  message: string;
  index_name: string;
  documents_queued?: number;
}

export interface UploadDocResponse {
  status: string;
  message: string;
  index_name: string;
  filename: string;
  chunk_count: number;
  token_counts: number[];
}

// =============================================================================
// Query Types
// =============================================================================

export interface QueryRequest {
  query: string;
  index_name: string;
  top_k?: number;
}

export interface QueryResponse {
  status: string;
  message: string;
  index_name: string;
  results: SearchResult[];
  query: string;
}

// =============================================================================
// Error Types
// =============================================================================

export interface ErrorResponse {
  status: string;
  message: string;
  detail?: string;
}
