# Requirements Document

## Introduction

This document specifies the requirements for a semantic knowledge base system that enables document ingestion, automatic chunking, embedding generation, and semantic search capabilities. The system consists of a Python FastAPI backend using LanceDB OSS for vector storage and a React/Vite/TypeScript frontend for user interaction. The backend processes documents using semantic chunking, generates embeddings using the Alibaba-NLP/gte-multilingual-base model, and provides reranked search results using the Alibaba-NLP/gte-multilingual-reranker-base model.

## Glossary

- **Knowledge Base System**: The complete application including backend API and frontend interface for document management and semantic search
- **Backend API**: The FastAPI-based Python 3.13 service that handles document encoding, storage, and search operations
- **Frontend Application**: The React/Vite/TypeScript web interface for user interaction with the knowledge base
- **LanceDB**: An open-source vector database used for storing and querying document embeddings
- **Embedding Model**: The Alibaba-NLP/gte-multilingual-base model (768 dimensions) used to convert text into vector representations
- **Reranking Model**: The Alibaba-NLP/gte-multilingual-reranker-base model used to improve search result relevance
- **Semantic Chunking**: A text segmentation strategy using the semchunk library that divides documents into semantically meaningful chunks based on hierarchical text structure (newlines, tabs, whitespace, punctuation)
- **semchunk**: A lightweight, production-ready Python library for splitting text into semantically meaningful chunks with support for custom tokenizers
- **Vector Embedding**: A numerical representation of text in a high-dimensional space (768 dimensions)
- **Semantic Search**: A search method that finds results based on meaning similarity rather than keyword matching
- **Chunk Size**: The maximum number of tokens a chunk may contain, configurable based on the embedding model's tokenizer
- **Index**: A named table in the LanceDB vector database that stores document chunks and their embeddings
- **index_name**: A unique identifier for a specific table/index in the vector database

## Requirements

### Requirement 1

**User Story:** As a user, I want to create named indexes in the knowledge base, so that I can organize documents into separate searchable collections.

#### Acceptance Criteria

1. WHEN a user submits a request to the `/create` endpoint with an `index_name` parameter THEN the Backend API SHALL create a new table in the LanceDB database with that name
2. WHEN the Backend API creates a new table THEN the Backend API SHALL define a schema with fields for id, content, embedding (768 dimensions), and source_document
3. WHEN the Backend API successfully creates a table THEN the Backend API SHALL return an HTTP 201 response with the index name and creation status
4. WHEN the Backend API receives a request to create an index that already exists THEN the Backend API SHALL return an HTTP 409 conflict error with a descriptive message
5. WHEN the Backend API receives an invalid index_name THEN the Backend API SHALL return an HTTP 400 error with validation details

### Requirement 2

**User Story:** As a user, I want to list all available indexes and get statistics about them, so that I can understand what document collections exist and their sizes.

#### Acceptance Criteria

1. WHEN a user submits a request to the `/indexes` endpoint THEN the Backend API SHALL return a list of all index names in the LanceDB database
2. WHEN the Backend API returns the list of indexes THEN the Backend API SHALL include a count of the total number of indexes
3. WHEN a user submits a request to the `/indexes/{index_name}/count` endpoint THEN the Backend API SHALL return the number of records (chunks) stored in the specified index
4. WHEN the Backend API successfully retrieves the record count THEN the Backend API SHALL return an HTTP 200 response with the index name and record count
5. WHEN the Backend API receives a request to get the record count for a non-existent index THEN the Backend API SHALL return an HTTP 404 error indicating the index does not exist

### Requirement 3

**User Story:** As a user, I want to add individual documents to a specific index in the knowledge base, so that I can build my searchable document collection incrementally and organize documents by topic.

#### Acceptance Criteria

1. WHEN a user submits a document to the `/encode_doc` endpoint THEN the Backend API SHALL accept the document path and `index_name` parameter as input
2. WHEN the Backend API receives a document path THEN the Backend API SHALL read the contents of the document as text and THEN apply semantic chunking using the semchunk library to divide the document into meaningful segments based on hierarchical text structure
3. WHEN the Backend API applies semantic chunking THEN the Backend API SHALL use a configurable chunk size determined by the embedding model's tokenizer
4. WHEN the Backend API chunks a document THEN the Backend API SHALL generate 768-dimensional vector embeddings for each chunk using the Alibaba-NLP/gte-multilingual-base model via HuggingFace SentenceTransformers
5. WHEN the Backend API generates embeddings THEN the Backend API SHALL store the chunks and their embeddings in the specified index table in LanceDB with metadata including source document identifier and chunk offset
6. WHEN the Backend API completes document encoding THEN the Backend API SHALL return a success response with the number of chunks created and their token counts
7. WHEN the Backend API receives a request with a non-existent `index_name` THEN the Backend API SHALL return an HTTP 404 error indicating the index does not exist

### Requirement 4

**User Story:** As a user, I want to add multiple documents from a directory in batch to a specific index, so that I can efficiently populate the knowledge base with existing document collections organized by topic.

#### Acceptance Criteria

1. WHEN a user submits a directory path to the `/encode_batch` endpoint THEN the Backend API SHALL accept the directory path and `index_name` parameter as input
2. WHEN the Backend API receives a directory path THEN the Backend API SHALL discover all documents in the specified directory and subdirectories
3. WHEN the Backend API discovers documents THEN the Backend API SHALL process each document asynchronously in the background using Python async/await patterns
4. WHEN the Backend API processes documents asynchronously THEN the Backend API SHALL apply semantic chunking using semchunk and generate embeddings for each document independently
5. WHEN the Backend API initiates batch processing THEN the Backend API SHALL return an immediate response indicating that processing has started
6. WHEN the Backend API completes batch processing THEN the Backend API SHALL log the completion status and document count using loguru
7. WHEN the Backend API receives a request with a non-existent `index_name` THEN the Backend API SHALL return an HTTP 404 error indicating the index does not exist

### Requirement 5

**User Story:** As a user, I want to search a specific index in the knowledge base using natural language queries, so that I can find relevant information based on semantic meaning within a particular document collection.

#### Acceptance Criteria

1. WHEN a user submits a query to the `/query` endpoint THEN the Backend API SHALL accept the query text and `index_name` parameter as input
2. WHEN the Backend API receives a query THEN the Backend API SHALL generate a 768-dimensional vector embedding for the query using the Alibaba-NLP/gte-multilingual-base model
3. WHEN the Backend API generates a query embedding THEN the Backend API SHALL perform vector similarity search in the specified index table in LanceDB
4. WHEN the Backend API performs vector search THEN the Backend API SHALL retrieve candidate results from the specified index
5. WHEN the Backend API retrieves candidate results THEN the Backend API SHALL apply the Alibaba-NLP/gte-multilingual-reranker-base model to rerank the results
6. WHEN the Backend API reranks results THEN the Backend API SHALL return the top 5 reranked results to the user
7. WHEN the Backend API receives a request with a non-existent `index_name` THEN the Backend API SHALL return an HTTP 404 error indicating the index does not exist

### Requirement 6

**User Story:** As a user, I want to interact with the knowledge base through a web interface, so that I can easily search for information without using command-line tools.

#### Acceptance Criteria

1. WHEN a user accesses the Frontend Application THEN the Frontend Application SHALL display a search interface with a text input field and an index selector
2. WHEN a user enters a query in the search box and selects an index THEN the Frontend Application SHALL enable a submit button for query execution
3. WHEN a user clicks the submit button THEN the Frontend Application SHALL send the query text and selected index_name to the Backend API `/query` endpoint
4. WHEN the Frontend Application receives search results THEN the Frontend Application SHALL display the top 5 results in a readable format
5. WHEN the Frontend Application displays results THEN the Frontend Application SHALL show the document content and relevance information for each result
6. WHEN the Frontend Application receives an error response for a non-existent index THEN the Frontend Application SHALL display an appropriate error message to the user

### Requirement 7

**User Story:** As a developer, I want the backend to use modern Python practices and proper logging, so that the system is maintainable and debuggable.

#### Acceptance Criteria

1. WHEN the Backend API is developed THEN the Backend API SHALL use Python 3.13 language features and best practices
2. WHEN the Backend API manages dependencies THEN the Backend API SHALL use uv as the package manager
3. WHEN the Backend API performs operations THEN the Backend API SHALL log all significant events using loguru
4. WHEN the Backend API logs events THEN the Backend API SHALL include appropriate log levels (info, warning, error) for different event types
5. WHEN the Backend API encounters errors THEN the Backend API SHALL log detailed error information including stack traces

### Requirement 8

**User Story:** As a developer, I want the system to use LanceDB OSS with proper schema definitions, so that document storage and retrieval are efficient and type-safe.

#### Acceptance Criteria

1. WHEN the Backend API initializes THEN the Backend API SHALL establish a connection to a local LanceDB database
2. WHEN the Backend API creates tables THEN the Backend API SHALL define a schema using LanceDB pydantic models with fields for document content, embeddings, and metadata
3. WHEN the Backend API stores embeddings THEN the Backend API SHALL use the Vector field type with 768 dimensions
4. WHEN the Backend API performs vector search THEN the Backend API SHALL use LanceDB native search capabilities
5. WHEN the Backend API accesses the database THEN the Backend API SHALL handle connection errors and log failures appropriately

### Requirement 9

**User Story:** As a developer, I want the embedding and reranking models to be properly initialized and managed, so that the system provides consistent and accurate results.

#### Acceptance Criteria

1. WHEN the Backend API starts THEN the Backend API SHALL load the Alibaba-NLP/gte-multilingual-base embedding model using HuggingFace SentenceTransformers
2. WHEN the Backend API starts THEN the Backend API SHALL load the Alibaba-NLP/gte-multilingual-reranker-base reranking model
3. WHEN the Backend API generates embeddings THEN the Backend API SHALL produce vectors with exactly 768 dimensions
4. WHEN the Backend API applies reranking THEN the Backend API SHALL use the reranking model to score and reorder candidate results
5. WHEN the Backend API loads models THEN the Backend API SHALL log model initialization status and any loading errors

### Requirement 10

**User Story:** As a user, I want the system to handle errors gracefully, so that I receive meaningful feedback when operations fail.

#### Acceptance Criteria

1. WHEN the Backend API encounters an invalid document format THEN the Backend API SHALL return an HTTP 400 error with a descriptive message
2. WHEN the Backend API encounters a non-existent directory path THEN the Backend API SHALL return an HTTP 404 error with a descriptive message
3. WHEN the Backend API encounters a non-existent index_name in `/query`, `/encode_doc`, or `/encode_batch` requests THEN the Backend API SHALL return an HTTP 404 error with a message indicating the specified index does not exist
4. WHEN the Backend API encounters a database error THEN the Backend API SHALL return an HTTP 500 error and log the detailed error
5. WHEN the Frontend Application receives an error response THEN the Frontend Application SHALL display the error message to the user
6. WHEN the Backend API processes requests THEN the Backend API SHALL validate all input parameters including index_name before processing
