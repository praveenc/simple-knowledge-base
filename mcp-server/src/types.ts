/**
 * API types for the Knowledge Base backend
 */

export interface SearchResult {
  content: string;
  relevance_score: number;
  source_document: string;
  chunk_offset: number;
}

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

export interface ListIndexesResponse {
  indexes: string[];
  count: number;
}

export interface HealthResponse {
  status: string;
  app: string;
}
