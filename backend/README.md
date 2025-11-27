# Semantic Knowledge Base Backend

A FastAPI-based semantic search API that enables document ingestion, automatic chunking, embedding generation, and intelligent search with reranking.

## Features

- **Document Ingestion**: Single file or batch directory processing
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
git clone <repo-url>
cd knowledge-base/backend

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

### Encode Single Document

```bash
POST /encode_doc
Content-Type: application/json

{
  "file_path": "/path/to/document.md",
  "metadata": {}  # optional
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Successfully encoded document with 5 chunks",
  "document_path": "/path/to/document.md",
  "chunk_count": 5,
  "token_counts": [355, 467, 483, 345, 483]
}
```

### Batch Encode Directory

```bash
POST /encode_batch
Content-Type: application/json

{
  "directory_path": "/path/to/docs",
  "file_patterns": ["*.md", "*.txt"]  # optional, defaults to common text formats
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Batch processing started for 65 documents",
  "documents_queued": 65
}
```

### Semantic Search

```bash
POST /query
Content-Type: application/json

{
  "query": "How do I create a table in LanceDB?",
  "top_k": 5  # optional, default: 5
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Found 5 results",
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
| `KB_TABLE_NAME` | `chunks` | LanceDB table name |
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
│   ├── database.py      # LanceDB connection & operations
│   └── services.py      # Document processing & ML models
├── data/
│   └── lancedb/         # Vector database storage
├── tests/               # Test suite
├── pyproject.toml       # Dependencies & project config
└── uv.lock              # Lock file
```

## How It Works

1. **Document Ingestion**
   - Read document content from file
   - Split into semantic chunks using hierarchical text boundaries
   - Generate 768-dim embeddings for each chunk
   - Store chunks + embeddings in LanceDB

2. **Semantic Search**
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
