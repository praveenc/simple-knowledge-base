# simple-knowledge-base Backend

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-00a393.svg)](https://fastapi.tiangolo.com)
[![LanceDB](https://img.shields.io/badge/LanceDB-0.19-orange.svg)](https://lancedb.com)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![Tests](https://img.shields.io/badge/tests-72%20passed-brightgreen.svg)](#running-tests)

A FastAPI-based semantic search API that enables document ingestion, automatic chunking, embedding generation, and intelligent search with reranking. Supports **multiple named indexes** for organizing different document collections.

## Features

- **Multi-Index Support**: Create and manage multiple named indexes for different document collections
- **Document Ingestion**: Single file or batch directory processing into specific indexes
- **Semantic Chunking**: Intelligent text segmentation using [semchunk](https://github.com/umarbutler/semchunk)
- **Vector Embeddings**: 768-dimensional embeddings via Alibaba-NLP/gte-multilingual-base
- **Reranked Search**: Two-stage retrieval with cross-encoder reranking
- **Local Vector Store**: LanceDB OSS for efficient similarity search

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| Vector DB | LanceDB 0.19.0 |
| Embeddings | Alibaba-NLP/gte-multilingual-base (768-dim) |
| Reranker | Alibaba-NLP/gte-multilingual-reranker-base |
| Chunking | semchunk |
| Python | 3.13+ |
| Package Manager | uv |

## Quick Start

### Prerequisites

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/praveenc/simple-knowledge-base.git
cd simple-knowledge-base/backend

# Install dependencies
uv sync

# Activate virtual environment
source .venv/bin/activate
```

### Running the Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

- **Swagger UI**: <http://localhost:8000/docs>
- **ReDoc**: <http://localhost:8000/redoc>

## API Endpoints

### Health Check

```bash
GET /health
```

### Create Index

Create a new named index for storing documents.

```bash
POST /create
Content-Type: application/json

{
  "index_name": "my_documents"
}
```

**Response (201 Created):**

```json
{
  "index_name": "my_documents",
  "status": "success",
  "message": "Index 'my_documents' created successfully"
}
```

### List Indexes

List all available indexes.

```bash
GET /indexes
```

**Response:**

```json
{
  "indexes": ["my_documents", "research_papers", "notes"],
  "count": 3
}
```

### Get Index Record Count

Get the number of records (chunks) in an index.

```bash
GET /indexes/{index_name}/count
```

**Response:**

```json
{
  "index_name": "my_documents",
  "record_count": 150
}
```

### Encode Single Document (Path)

Add a document to a specific index using a server-side file path.

```bash
POST /encode_doc
Content-Type: application/json

{
  "document_path": "/path/to/document.md",
  "index_name": "my_documents",
  "metadata": {}  # optional
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Successfully encoded document with 5 chunks",
  "index_name": "my_documents",
  "document_path": "/path/to/document.md",
  "chunk_count": 5,
  "token_counts": [355, 467, 483, 345, 483]
}
```

### Upload Document (File Upload)

Upload and encode a document file directly via multipart form data.

```bash
POST /upload_doc
Content-Type: multipart/form-data

file: <binary file data>
index_name: "my_documents"
```

**Supported file types:** `.md`, `.txt`

**Response:**

```json
{
  "status": "success",
  "message": "Successfully encoded document with 5 chunks",
  "index_name": "my_documents",
  "filename": "document.md",
  "chunk_count": 5,
  "token_counts": [355, 467, 483, 345, 483]
}
```

### Batch Encode Directory

Add all matching documents from a directory to a specific index.

```bash
POST /encode_batch
Content-Type: application/json

{
  "directory_path": "/path/to/docs",
  "index_name": "my_documents",
  "file_patterns": ["*.md", "*.txt"]  # optional, defaults to common text formats
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Batch processing started for 65 documents",
  "index_name": "my_documents",
  "documents_queued": 65
}
```

### Semantic Search

Search for documents in a specific index.

```bash
POST /query
Content-Type: application/json

{
  "query": "How do I create a table in LanceDB?",
  "index_name": "my_documents",
  "top_k": 5  # optional, default: 5
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Found 5 results",
  "index_name": "my_documents",
  "results": [
    {
      "content": "## Create a table\n\nNext, let's create a Table...",
      "relevance_score": 0.834,
      "source_document": "/path/to/doc.md",
      "chunk_offset": 1346
    }
  ],
  "query": "How do I create a table in LanceDB?"
}
```

## Configuration

Configuration is managed via environment variables (prefix: `KB_`) or a `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `KB_DEBUG` | `false` | Enable debug mode |
| `KB_LANCEDB_PATH` | `./data/lancedb` | Path to LanceDB storage |
| `KB_EMBEDDING_MODEL` | `Alibaba-NLP/gte-multilingual-base` | HuggingFace embedding model |
| `KB_RERANKER_MODEL` | `Alibaba-NLP/gte-multilingual-reranker-base` | HuggingFace reranker model |
| `KB_MAX_CHUNK_TOKENS` | `512` | Maximum tokens per chunk |
| `KB_DEFAULT_TOP_K` | `5` | Default number of search results |
| `KB_VECTOR_SEARCH_LIMIT` | `20` | Candidates to fetch before reranking |

## Project Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application & endpoints
│   ├── models.py        # Pydantic models & LanceDB schema
│   ├── config.py        # Configuration settings
│   ├── database.py      # LanceDB connection & multi-index operations
│   ├── exceptions.py    # Custom exception classes
│   └── services.py      # Document processing & ML models
├── data/
│   └── lancedb/         # Vector database storage (indexes as tables)
├── tests/               # Test suite
├── pyproject.toml       # Dependencies & project config
└── uv.lock              # Lock file
```

## How It Works

1. **Index Management**
   - Create named indexes to organize different document collections
   - Each index is stored as a separate LanceDB table
   - List and manage multiple indexes independently

2. **Document Ingestion**
   - Specify target index for document storage
   - Read document content from file
   - Split into semantic chunks using hierarchical text boundaries
   - Generate 768-dim embeddings for each chunk
   - Store chunks + embeddings in the specified index

3. **Semantic Search**
   - Specify which index to search
   - Generate embedding for query
   - Retrieve top-k candidates via vector similarity (L2 distance)
   - Rerank candidates using cross-encoder model
   - Return top results sorted by relevance

## Development

### Running Tests

```bash
# Install dev dependencies
uv sync --extra dev

# Run tests
pytest

# Run with coverage
pytest --cov=app
```

### Code Style

The project follows Python best practices with type hints throughout.

## License

MIT
