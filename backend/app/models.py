"""Pydantic models for API requests/responses and LanceDB schema."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from lancedb.pydantic import LanceModel, Vector
from pydantic import BaseModel, Field

# =============================================================================
# LanceDB Schema Models
# =============================================================================


class ChunkSchema(LanceModel):
    """Schema for document chunks stored in LanceDB."""

    chunk_id: str = Field(..., description="Unique identifier for the chunk")
    content: str = Field(..., description="Text content of the chunk")
    embedding: Vector(768) = Field(..., description="768-dimensional embedding vector")  # type: ignore[valid-type]
    source_document: str = Field(..., description="Source document identifier/path")
    chunk_offset: int = Field(
        ...,
        description="Character offset in the original document",
    )
    token_count: int = Field(..., description="Number of tokens in the chunk")
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when chunk was created",
    )


# =============================================================================
# Index Name Pattern
# =============================================================================

# Pattern: starts with letter, followed by alphanumeric, underscore, or hyphen
INDEX_NAME_PATTERN = r"^[a-zA-Z][a-zA-Z0-9_-]*$"


# =============================================================================
# API Request Models
# =============================================================================


class CreateIndexRequest(BaseModel):
    """Request model for creating a new index."""

    index_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=INDEX_NAME_PATTERN,
        description="Index name (starts with letter, alphanumeric/underscore/hyphen only)",
    )


class EncodeDocRequest(BaseModel):
    """Request model for single document encoding."""

    document_path: str = Field(..., description="Absolute path to the document file")
    index_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=INDEX_NAME_PATTERN,
        description="Target index name",
    )
    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Optional metadata for the document",
    )


class EncodeBatchRequest(BaseModel):
    """Request model for batch document encoding from a directory."""

    directory_path: str = Field(..., description="Absolute path to the directory")
    index_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=INDEX_NAME_PATTERN,
        description="Target index name",
    )
    file_patterns: list[str] | None = Field(
        default=None,
        description="File patterns to include (e.g., ['*.txt', '*.md']). Defaults to common text formats.",
    )


class QueryRequest(BaseModel):
    """Request model for semantic search queries."""

    query: str = Field(..., min_length=1, description="Search query text")
    index_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=INDEX_NAME_PATTERN,
        description="Index to search in",
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Number of results to return",
    )


# =============================================================================
# API Response Models
# =============================================================================


class CreateIndexResponse(BaseModel):
    """Response model for index creation."""

    index_name: str = Field(..., description="Name of the created index")
    status: str = Field(..., description="Operation status: 'success' or 'error'")
    message: str = Field(..., description="Status message")


class ListIndexesResponse(BaseModel):
    """Response model for listing indexes."""

    indexes: list[str] = Field(default_factory=list, description="List of index names")
    count: int = Field(..., description="Number of indexes")


class IndexRecordCountResponse(BaseModel):
    """Response model for index record count."""

    index_name: str = Field(..., description="Name of the index")
    record_count: int = Field(..., description="Number of records in the index")


class SearchResult(BaseModel):
    """Model for a single search result."""

    content: str = Field(..., description="Text content of the chunk")
    relevance_score: float = Field(..., description="Relevance score after reranking")
    source_document: str = Field(..., description="Source document identifier/path")
    chunk_offset: int = Field(..., description="Character offset in original document")


class EncodeDocResponse(BaseModel):
    """Response model for single document encoding."""

    status: str = Field(..., description="Operation status: 'success' or 'error'")
    message: str = Field(..., description="Status message")
    index_name: str = Field(..., description="Index the document was added to")
    document_path: str | None = Field(
        default=None,
        description="Path of the encoded document",
    )
    chunk_count: int | None = Field(
        default=None,
        description="Number of chunks created",
    )
    token_counts: list[int] | None = Field(
        default=None,
        description="Token count for each chunk",
    )


class UploadDocResponse(BaseModel):
    """Response model for file upload encoding."""

    status: str = Field(..., description="Operation status: 'success' or 'error'")
    message: str = Field(..., description="Status message")
    index_name: str = Field(..., description="Index the document was added to")
    filename: str = Field(..., description="Original filename of the uploaded document")
    chunk_count: int = Field(default=0, description="Number of chunks created")
    token_counts: list[int] = Field(
        default_factory=list,
        description="Token count for each chunk",
    )


class EncodeBatchResponse(BaseModel):
    """Response model for batch document encoding."""

    status: str = Field(..., description="Operation status: 'success' or 'error'")
    message: str = Field(..., description="Status message")
    index_name: str = Field(..., description="Index the documents are being added to")
    documents_queued: int | None = Field(
        default=None,
        description="Number of documents queued for processing",
    )


class QueryResponse(BaseModel):
    """Response model for semantic search queries."""

    status: str = Field(..., description="Operation status: 'success' or 'error'")
    message: str = Field(..., description="Status message")
    index_name: str = Field(..., description="Index that was searched")
    results: list[SearchResult] = Field(
        default_factory=list,
        description="List of search results",
    )
    query: str | None = Field(default=None, description="The original query")


class ErrorResponse(BaseModel):
    """Standard error response model."""

    status: str = Field(
        default="error",
        description="Always 'error' for error responses",
    )
    message: str = Field(..., description="Error message")
    detail: str | None = Field(
        default=None,
        description="Detailed error information",
    )
