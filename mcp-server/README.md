# Simple Knowledge Base MCP Server

[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.0.0-blue.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

An MCP (Model Context Protocol) server that provides semantic search capabilities over the Simple Knowledge Base. Use it to give AI assistants access to your indexed documents.

## Features

| Tool | Description |
|------|-------------|
| `kb_list_indexes` | List all available indexes in the knowledge base |
| `kb_search_docs` | Semantic search across documents with ranked results |
| `kb_fetch_doc` | Fetch chunks from a specific source document |

## Quick Start

### 1. Start the Backend

The MCP server requires the Simple Knowledge Base backend to be running:

```bash
# From the project root
cd simple-knowledge-base

make install    # Install all dependencies (first time only)
make backend    # Start the backend on http://localhost:8000
```

### 2. Install & Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 3. Configure Your MCP Client

Add to your MCP client configuration file (e.g., `.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "simple-kb": {
      "command": "node",
      "args": ["/absolute/path/to/simple-knowledge-base/mcp-server/dist/index.js"],
      "env": {
        "KB_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

> **Note:** Replace `/absolute/path/to/` with the actual path to your installation.

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `KB_API_URL` | Backend API URL | `http://localhost:8000` |

Example with custom port:

```bash
KB_API_URL=http://localhost:9000 npm start
```

## Development

```bash
# Run in development mode (with hot reload via tsx)
npm run dev

# Type check without building
npm run typecheck

# Build for production
npm run build

# Run production build
npm start
```

### Testing with MCP Inspector

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) lets you interactively test your server:

```bash
# Test development version
npm run inspect:dev

# Test production build
npm run inspect
```

## Tools Reference

### kb_list_indexes

List all available indexes in the knowledge base. Use this first to discover which indexes are available.

**Input:** None

**Example Output:**

```json
{
  "indexes": ["my-docs", "research-papers"],
  "count": 2
}
```

---

### kb_search_docs

Search the knowledge base using natural language. Returns semantically ranked results with content snippets.

**Input:**

- `query` (string, required) - Natural language search query
- `index_name` (string, required) - Name of the index to search
- `top_k` (number, optional) - Maximum results to return (default: 5)

**Example Output:**

```json
{
  "query": "how to configure logging",
  "index_name": "my-docs",
  "results": [
    {
      "content": "To configure logging, set the LOG_LEVEL environment variable...",
      "relevance_score": 0.85,
      "source_document": "/docs/configuration.md",
      "chunk_offset": 3
    }
  ],
  "total_results": 1
}
```

---

### kb_fetch_doc

Fetch all chunks from a specific document. Use this after `kb_search_docs` to get more context from a source.

**Input:**

- `index_name` (string, required) - Name of the index containing the document
- `source_document` (string, required) - Path or name of the source document
- `top_k` (number, optional) - Maximum chunks to return (default: 10)

**Example Output:**

```json
{
  "source_document": "configuration.md",
  "chunks": [
    {
      "content": "Configuration section content...",
      "chunk_offset": 0,
      "relevance_score": 0.92
    }
  ],
  "total_chunks": 1
}
```

## Typical Workflow

1. **List indexes** to see what's available:

   ```
   kb_list_indexes
   ```

2. **Search** for relevant content:

   ```
   kb_search_docs(query="authentication setup", index_name="my-docs", top_k=5)
   ```

3. **Fetch more** from a specific document if needed:

   ```
   kb_fetch_doc(index_name="my-docs", source_document="auth-guide.md", top_k=10)
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Backend connection: FAILED" | Ensure the backend is running (`make backend` from project root) |
| "Failed to list indexes" | Check `KB_API_URL` points to the correct backend URL |
| Empty search results | Verify the index exists and contains documents |

## License

MIT
