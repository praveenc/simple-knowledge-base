/**
 * MCP tools for Simple Knowledge Base
 */

import { queryKnowledgeBase, listIndexes } from "./api-client.js";
import type { SearchResult } from "./types.js";

export interface KBSearchResult {
  content: string;
  relevance_score: number;
  source_document: string;
  chunk_offset: number;
}

export interface KBSearchResponse {
  query: string;
  index_name: string;
  results: KBSearchResult[];
  total_results: number;
}

export interface KBFetchResponse {
  source_document: string;
  chunks: {
    content: string;
    chunk_offset: number;
    relevance_score: number;
  }[];
  total_chunks: number;
}

export interface KBListIndexesResponse {
  indexes: string[];
  count: number;
}

/**
 * Search the knowledge base for relevant documents.
 *
 * @param query - Natural language search query
 * @param indexName - Name of the index to search
 * @param topK - Maximum number of results to return (default: 5)
 * @returns Search results with content, relevance scores, and source documents
 */
export async function kbSearchDocs(
  query: string,
  indexName: string,
  topK: number = 5
): Promise<KBSearchResponse> {
  const response = await queryKnowledgeBase({
    query,
    index_name: indexName,
    top_k: topK,
  });

  return {
    query: response.query,
    index_name: response.index_name,
    results: response.results.map((r: SearchResult) => ({
      content: r.content,
      relevance_score: r.relevance_score,
      source_document: r.source_document,
      chunk_offset: r.chunk_offset,
    })),
    total_results: response.results.length,
  };
}

/**
 * Fetch all chunks from a specific document in the knowledge base.
 *
 * This searches for the document by name and returns all matching chunks.
 *
 * @param indexName - Name of the index to search
 * @param sourceDocument - Path or name of the source document to fetch
 * @param topK - Maximum number of chunks to return (default: 10)
 * @returns Document chunks with content and metadata
 */
export async function kbFetchDoc(
  indexName: string,
  sourceDocument: string,
  topK: number = 10
): Promise<KBFetchResponse> {
  // Search using the document name as query to find relevant chunks
  const response = await queryKnowledgeBase({
    query: sourceDocument,
    index_name: indexName,
    top_k: topK,
  });

  // Filter results to only include chunks from the specified document
  const matchingChunks = response.results.filter((r: SearchResult) =>
    r.source_document.toLowerCase().includes(sourceDocument.toLowerCase())
  );

  return {
    source_document: sourceDocument,
    chunks: matchingChunks.map((r: SearchResult) => ({
      content: r.content,
      chunk_offset: r.chunk_offset,
      relevance_score: r.relevance_score,
    })),
    total_chunks: matchingChunks.length,
  };
}

/**
 * List all available indexes in the knowledge base.
 *
 * @returns List of index names and count
 */
export async function kbListIndexes(): Promise<KBListIndexesResponse> {
  const response = await listIndexes();
  return {
    indexes: response.indexes,
    count: response.count,
  };
}
