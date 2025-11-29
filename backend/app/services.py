"""Document processing services: chunking, embedding, and reranking."""

from __future__ import annotations

from pathlib import Path

import semchunk
from loguru import logger
from sentence_transformers import CrossEncoder, SentenceTransformer

from app.config import settings
from app.exceptions import DirectoryNotFoundError, DocumentNotFoundError

# =============================================================================
# Type Aliases (PEP 695 - Python 3.12+)
# =============================================================================

# Embedding types
type Embedding = list[float]
type EmbeddingBatch = list[Embedding]

# Document processing result types
type ChunkOffsets = list[int]
type TokenCounts = list[int]
type ChunkResult = tuple[list[str], ChunkOffsets]
type DocumentResult = tuple[list[str], EmbeddingBatch, ChunkOffsets, TokenCounts]

# Reranking result: list of (index, score) tuples
type RerankResult = list[tuple[int, float]]


class ModelManager:
    """Manages ML models for embedding and reranking."""

    def __init__(self) -> None:
        """Initialize the model manager with lazy loading."""
        self._embedding_model: SentenceTransformer | None = None
        self._reranker_model: CrossEncoder | None = None
        self._tokenizer = None

    @property
    def embedding_model(self) -> SentenceTransformer:
        """Lazy load and return the embedding model."""
        if self._embedding_model is None:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            self._embedding_model = SentenceTransformer(
                settings.embedding_model,
                trust_remote_code=True,
            )
            logger.info(
                f"Embedding model loaded. Dimension: {self._embedding_model.get_sentence_embedding_dimension()}",
            )
        return self._embedding_model

    @property
    def reranker_model(self) -> CrossEncoder:
        """Lazy load and return the reranker model."""
        if self._reranker_model is None:
            logger.info(f"Loading reranker model: {settings.reranker_model}")
            self._reranker_model = CrossEncoder(
                settings.reranker_model,
                trust_remote_code=True,
            )
            logger.info("Reranker model loaded")
        return self._reranker_model

    @property
    def tokenizer(self):
        """Get the tokenizer from the embedding model."""
        if self._tokenizer is None:
            self._tokenizer = self.embedding_model.tokenizer
        return self._tokenizer

    def encode(self, texts: list[str]) -> EmbeddingBatch:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of texts to encode.

        Returns:
            List of embedding vectors (768-dim each).

        """
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    def encode_query(self, query: str) -> Embedding:
        """
        Generate embedding for a query.

        Args:
            query: Query text.

        Returns:
            Embedding vector (768-dim).

        """
        embedding = self.embedding_model.encode(query, convert_to_numpy=True)
        return embedding.tolist()

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 5,
    ) -> RerankResult:
        """
        Rerank documents based on relevance to query.

        Args:
            query: Query text.
            documents: List of document texts to rerank.
            top_k: Number of top results to return.

        Returns:
            List of (index, score) tuples sorted by relevance.

        """
        if not documents:
            return []

        # Create query-document pairs
        pairs = [[query, doc] for doc in documents]

        # Get relevance scores
        scores = self.reranker_model.predict(pairs)

        # Create index-score pairs and sort by score descending
        indexed_scores = list(enumerate(scores))
        indexed_scores.sort(key=lambda x: x[1], reverse=True)

        return indexed_scores[:top_k]

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in a text using the embedding model's tokenizer.

        Args:
            text: Text to count tokens for.

        Returns:
            Number of tokens.

        """
        return len(self.tokenizer.encode(text))


# Global model manager instance
model_manager = ModelManager()


class DocumentProcessor:
    """Processes documents: reading, chunking, and encoding."""

    def __init__(self, model_manager: ModelManager) -> None:
        """Initialize with a model manager."""
        self.model_manager = model_manager
        self._chunker = None

    @property
    def chunker(self):
        """Lazy load the semantic chunker."""
        if self._chunker is None:
            # Create chunker using the model's tokenizer
            self._chunker = semchunk.chunkerify(
                self.model_manager.tokenizer,
                chunk_size=settings.max_chunk_tokens,
            )
        return self._chunker

    def read_document(self, file_path: str) -> str:
        """
        Read document content from file.

        Args:
            file_path: Path to the document file.

        Returns:
            Document content as string.

        Raises:
            DocumentNotFoundError: If file doesn't exist.
            ValueError: If path is not a file.

        """
        path = Path(file_path)

        if not path.exists():
            raise DocumentNotFoundError(file_path)

        if not path.is_file():
            msg = f"Path is not a file: {file_path}"
            raise ValueError(msg)

        logger.debug(f"Reading document: {file_path}")
        return path.read_text(encoding="utf-8")

    def chunk_document(self, content: str) -> ChunkResult:
        """
        Split document into semantic chunks.

        Args:
            content: Document content.

        Returns:
            Tuple of (chunks, offsets) where offsets are character positions.

        """
        chunks = self.chunker(content)

        # Calculate character offsets for each chunk
        offsets = []
        current_offset = 0
        for chunk in chunks:
            # Find the chunk in the content starting from current position
            idx = content.find(chunk, current_offset)
            if idx != -1:
                offsets.append(idx)
                current_offset = idx + len(chunk)
            else:
                # Fallback: use current offset if exact match not found
                offsets.append(current_offset)
                current_offset += len(chunk)

        logger.debug(f"Document chunked into {len(chunks)} chunks")
        return chunks, offsets

    def process_document(
        self,
        file_path: str,
    ) -> DocumentResult:
        """
        Process a document: read, chunk, and generate embeddings.

        Args:
            file_path: Path to the document file.

        Returns:
            Tuple of (chunks, embeddings, offsets, token_counts).

        """
        # Read document
        content = self.read_document(file_path)

        # Chunk document
        chunks, offsets = self.chunk_document(content)

        if not chunks:
            logger.warning(f"No chunks generated for document: {file_path}")
            return [], [], [], []

        # Generate embeddings
        embeddings = self.model_manager.encode(chunks)

        # Count tokens for each chunk
        token_counts = [self.model_manager.count_tokens(chunk) for chunk in chunks]

        logger.info(
            f"Processed {file_path}: {len(chunks)} chunks, token counts: {token_counts}",
        )

        return chunks, embeddings, offsets, token_counts

    def discover_documents(
        self,
        directory_path: str,
        patterns: list[str] | None = None,
    ) -> list[Path]:
        """
        Discover documents in a directory matching patterns.

        Args:
            directory_path: Path to the directory.
            patterns: File patterns to match (e.g., ['*.txt', '*.md']).

        Returns:
            List of discovered document paths.

        Raises:
            DirectoryNotFoundError: If directory doesn't exist.
            ValueError: If path is not a directory.

        """
        path = Path(directory_path)

        if not path.exists():
            raise DirectoryNotFoundError(directory_path)

        if not path.is_dir():
            msg = f"Path is not a directory: {directory_path}"
            raise ValueError(msg)

        patterns = patterns or settings.default_file_patterns
        documents = []

        for pattern in patterns:
            documents.extend(path.rglob(pattern))

        # Remove duplicates and sort
        documents = sorted(set(documents))

        logger.info(
            f"Discovered {len(documents)} documents in {directory_path} "
            f"matching patterns: {patterns}",
        )

        return documents


# Global document processor instance
document_processor = DocumentProcessor(model_manager)
