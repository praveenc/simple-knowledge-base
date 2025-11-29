"""FastAPI application with semantic knowledge base endpoints."""

from __future__ import annotations

import asyncio
import re
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.config import settings
from app.database import db_manager
from app.exceptions import (
    DirectoryNotFoundError,
    DocumentNotFoundError,
    IndexAlreadyExistsError,
    IndexNotFoundError,
)
from app.models import (
    INDEX_NAME_PATTERN,
    CreateIndexRequest,
    CreateIndexResponse,
    EncodeBatchRequest,
    EncodeBatchResponse,
    EncodeDocRequest,
    EncodeDocResponse,
    ErrorResponse,
    IndexRecordCountResponse,
    ListIndexesResponse,
    QueryRequest,
    QueryResponse,
    SearchResult,
    UploadDocResponse,
)
from app.services import document_processor, model_manager


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"LanceDB path: {settings.lancedb_uri}")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"Reranker model: {settings.reranker_model}")

    # Initialize database connection
    db_manager.connect()

    yield

    # Shutdown
    logger.info("Shutting down application")
    db_manager.close()


app = FastAPI(
    title=settings.app_name,
    description="Semantic Knowledge Base API with document ingestion and semantic search",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Exception Handlers
# =============================================================================


@app.exception_handler(IndexNotFoundError)
async def index_not_found_handler(
    _request: Request,
    exc: IndexNotFoundError,
) -> JSONResponse:
    """Handle IndexNotFoundError exceptions."""
    logger.warning(f"Index not found: {exc.index_name}")
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "status": "error",
            "message": str(exc),
            "detail": f"Index '{exc.index_name}' does not exist",
        },
    )


@app.exception_handler(IndexAlreadyExistsError)
async def index_already_exists_handler(
    _request: Request,
    exc: IndexAlreadyExistsError,
) -> JSONResponse:
    """Handle IndexAlreadyExistsError exceptions."""
    logger.warning(f"Index already exists: {exc.index_name}")
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "status": "error",
            "message": str(exc),
            "detail": f"Index '{exc.index_name}' already exists",
        },
    )


@app.exception_handler(DocumentNotFoundError)
async def document_not_found_handler(
    _request: Request,
    exc: DocumentNotFoundError,
) -> JSONResponse:
    """Handle DocumentNotFoundError exceptions."""
    logger.warning(f"Document not found: {exc.document_path}")
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "status": "error",
            "message": str(exc),
            "detail": f"Document not found: {exc.document_path}",
        },
    )


@app.exception_handler(DirectoryNotFoundError)
async def directory_not_found_handler(
    _request: Request,
    exc: DirectoryNotFoundError,
) -> JSONResponse:
    """Handle DirectoryNotFoundError exceptions."""
    logger.warning(f"Directory not found: {exc.directory_path}")
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "status": "error",
            "message": str(exc),
            "detail": f"Directory not found: {exc.directory_path}",
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(
    _request: Request,
    exc: ValueError,
) -> JSONResponse:
    """Handle ValueError exceptions (invalid input)."""
    logger.warning(f"Invalid input: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "status": "error",
            "message": str(exc),
            "detail": str(exc),
        },
    )


# =============================================================================
# Health Check
# =============================================================================


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


# =============================================================================
# Index Management Endpoints
# =============================================================================


@app.post(
    "/create",
    response_model=CreateIndexResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid index name"},
        409: {"model": ErrorResponse, "description": "Index already exists"},
    },
)
async def create_index(request: CreateIndexRequest) -> CreateIndexResponse:
    """
    Create a new index in the knowledge base.

    Creates a new table in LanceDB with the specified index name.
    """
    logger.info(f"Creating index: {request.index_name}")

    db_manager.create_index(request.index_name)

    return CreateIndexResponse(
        index_name=request.index_name,
        status="success",
        message=f"Index '{request.index_name}' created successfully",
    )


@app.get(
    "/indexes",
    response_model=ListIndexesResponse,
)
async def list_indexes() -> ListIndexesResponse:
    """
    List all available indexes in the knowledge base.

    Returns a list of all index names.
    """
    indexes = db_manager.list_indexes()
    return ListIndexesResponse(
        indexes=indexes,
        count=len(indexes),
    )


@app.get(
    "/indexes/{index_name}/count",
    response_model=IndexRecordCountResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Index not found"},
    },
)
async def get_record_count(index_name: str) -> IndexRecordCountResponse:
    """
    Get the number of records in an index.

    Returns the count of chunks/rows stored in the specified index.
    """
    logger.info(f"Getting record count for index: {index_name}")
    count = db_manager.count_rows(index_name)
    return IndexRecordCountResponse(
        index_name=index_name,
        record_count=count,
    )


# =============================================================================
# Document Encoding Endpoints
# =============================================================================


@app.post(
    "/encode_doc",
    response_model=EncodeDocResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid document format"},
        404: {"model": ErrorResponse, "description": "Document not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def encode_document(request: EncodeDocRequest) -> EncodeDocResponse:
    """
    Encode a single document into a specific index.

    Reads the document, chunks it semantically, generates embeddings,
    and stores the chunks in the specified index in LanceDB.
    """
    logger.info(
        f"Encoding document: {request.document_path} -> index: {request.index_name}",
    )

    # Process document (raises DocumentNotFoundError if not found)
    chunks, embeddings, offsets, token_counts = document_processor.process_document(
        request.document_path,
    )

    if not chunks:
        return EncodeDocResponse(
            status="success",
            message="Document processed but no chunks generated (empty document)",
            index_name=request.index_name,
            document_path=request.document_path,
            chunk_count=0,
            token_counts=[],
        )

    # Store in database (raises IndexNotFoundError if index doesn't exist)
    db_manager.add_chunks(
        index_name=request.index_name,
        contents=chunks,
        embeddings=embeddings,
        source_document=request.document_path,
        chunk_offsets=offsets,
        token_counts=token_counts,
    )

    return EncodeDocResponse(
        status="success",
        message=f"Successfully encoded document with {len(chunks)} chunks",
        index_name=request.index_name,
        document_path=request.document_path,
        chunk_count=len(chunks),
        token_counts=token_counts,
    )


# Allowed file extensions for upload
ALLOWED_EXTENSIONS = {".md", ".txt"}


@app.post(
    "/upload_doc",
    response_model=UploadDocResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file or index name"},
        404: {"model": ErrorResponse, "description": "Index not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def upload_document(
    file: UploadFile = File(..., description="Document file to upload"),
    index_name: str = Form(..., description="Target index name"),
) -> UploadDocResponse:
    """
    Upload and encode a document file into a specific index.

    Accepts a file upload, validates the file type, processes the content,
    generates embeddings, and stores the chunks in the specified index.
    """
    # Validate index name format
    if not re.match(INDEX_NAME_PATTERN, index_name):
        raise ValueError(
            f"Invalid index name '{index_name}'. Must start with a letter, "
            "followed by alphanumeric characters, underscores, or hyphens.",
        )

    # Verify index exists
    if not db_manager.index_exists(index_name):
        raise IndexNotFoundError(index_name)

    # Validate file
    if not file.filename:
        raise ValueError("No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{file_ext}'. "
            f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    logger.info(f"Uploading document: {file.filename} -> index: {index_name}")

    # Read file content
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValueError(
            f"File encoding error: {e}. Please ensure the file is UTF-8 encoded.",
        ) from e

    if not text_content.strip():
        return UploadDocResponse(
            status="success",
            message="Document processed but no content found (empty file)",
            index_name=index_name,
            filename=file.filename,
            chunk_count=0,
            token_counts=[],
        )

    # Write to temp file for processing (reuse existing document processor)
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=file_ext,
        delete=False,
        encoding="utf-8",
    ) as tmp_file:
        tmp_file.write(text_content)
        tmp_path = tmp_file.name

    try:
        # Process document using existing processor
        chunks, embeddings, offsets, token_counts = document_processor.process_document(
            tmp_path,
        )

        if not chunks:
            return UploadDocResponse(
                status="success",
                message="Document processed but no chunks generated",
                index_name=index_name,
                filename=file.filename,
                chunk_count=0,
                token_counts=[],
            )

        # Store in database with original filename as source
        db_manager.add_chunks(
            index_name=index_name,
            contents=chunks,
            embeddings=embeddings,
            source_document=file.filename,
            chunk_offsets=offsets,
            token_counts=token_counts,
        )

        return UploadDocResponse(
            status="success",
            message=f"Successfully encoded document with {len(chunks)} chunks",
            index_name=index_name,
            filename=file.filename,
            chunk_count=len(chunks),
            token_counts=token_counts,
        )

    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)


async def _process_batch_async(
    index_name: str,
    directory_path: str,
    file_patterns: list[str] | None,
) -> None:
    """
    Background task to process documents in batch.

    Args:
        index_name: Target index name.
        directory_path: Path to the directory.
        file_patterns: File patterns to match.

    """
    logger.info(
        f"Starting batch processing for: {directory_path} -> index: {index_name}",
    )

    try:
        documents = document_processor.discover_documents(directory_path, file_patterns)

        processed = 0
        failed = 0

        for doc_path in documents:
            try:
                chunks, embeddings, offsets, token_counts = (
                    document_processor.process_document(str(doc_path))
                )

                if chunks:
                    db_manager.add_chunks(
                        index_name=index_name,
                        contents=chunks,
                        embeddings=embeddings,
                        source_document=str(doc_path),
                        chunk_offsets=offsets,
                        token_counts=token_counts,
                    )
                    processed += 1

            except Exception:  # noqa: BLE001, PERF203
                logger.exception(f"Failed to process {doc_path}")
                failed += 1

        logger.info(
            f"Batch processing complete for '{index_name}': "
            f"{processed} processed, {failed} failed",
        )

    except Exception:  # noqa: BLE001
        logger.exception("Batch processing failed")


@app.post(
    "/encode_batch",
    response_model=EncodeBatchResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Directory or index not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def encode_batch(request: EncodeBatchRequest) -> EncodeBatchResponse:
    """
    Encode documents from a directory into a specific index.

    Discovers documents matching the specified patterns, processes them
    asynchronously in the background into the specified index.
    """
    logger.info(
        f"Batch encoding from: {request.directory_path} -> index: {request.index_name}",
    )

    # Verify index exists (raises IndexNotFoundError if not)
    if not db_manager.index_exists(request.index_name):
        raise IndexNotFoundError(request.index_name)

    # Discover documents (raises DirectoryNotFoundError if not found)
    documents = document_processor.discover_documents(
        request.directory_path,
        request.file_patterns,
    )

    if not documents:
        return EncodeBatchResponse(
            status="success",
            message="No documents found matching the specified patterns",
            index_name=request.index_name,
            documents_queued=0,
        )

    # Start background processing (fire and forget)
    _ = asyncio.create_task(  # noqa: RUF006
        _process_batch_async(
            request.index_name,
            request.directory_path,
            request.file_patterns,
        ),
    )

    return EncodeBatchResponse(
        status="success",
        message=f"Batch processing started for {len(documents)} documents",
        index_name=request.index_name,
        documents_queued=len(documents),
    )


# =============================================================================
# Query Endpoint
# =============================================================================


@app.post(
    "/query",
    response_model=QueryResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid query"},
        404: {"model": ErrorResponse, "description": "Index not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def query(request: QueryRequest) -> QueryResponse:
    """
    Perform semantic search on a specific index.

    Generates a query embedding, performs vector search in the specified index,
    and reranks results using the reranker model.
    """
    logger.info(f"Query on '{request.index_name}': {request.query[:50]}...")

    # Generate query embedding
    query_embedding = model_manager.encode_query(request.query)

    # Perform vector search (raises IndexNotFoundError if index doesn't exist)
    candidates = db_manager.vector_search(
        index_name=request.index_name,
        query_embedding=query_embedding,
        limit=settings.vector_search_limit,
    )

    if not candidates:
        return QueryResponse(
            status="success",
            message="No results found",
            index_name=request.index_name,
            results=[],
            query=request.query,
        )

    # Extract documents for reranking
    documents = [c["content"] for c in candidates]

    # Rerank results
    reranked = model_manager.rerank(request.query, documents, top_k=request.top_k)

    # Build results
    results = [
        SearchResult(
            content=candidates[idx]["content"],
            relevance_score=float(score),
            source_document=candidates[idx]["source_document"],
            chunk_offset=candidates[idx]["chunk_offset"],
        )
        for idx, score in reranked
    ]

    return QueryResponse(
        status="success",
        message=f"Found {len(results)} results",
        index_name=request.index_name,
        results=results,
        query=request.query,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # noqa: S104
        port=8000,
        reload=True,
    )
