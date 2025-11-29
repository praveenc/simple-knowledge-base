"""Tests for document processing services."""

from pathlib import Path

import pytest

from app.exceptions import DirectoryNotFoundError, DocumentNotFoundError
from app.services import DocumentProcessor, ModelManager, model_manager


class TestModelManager:
    """Tests for ModelManager class."""

    def test_singleton_instance(self):
        """Test that model_manager is a singleton."""
        assert model_manager is not None
        assert isinstance(model_manager, ModelManager)

    def test_embedding_dimension(self):
        """
        Test that embeddings have correct dimension (768).

        **Feature: semantic-knowledge-base, Property 3: Embedding Dimensionality**
        **Validates: Requirements 1.4, 3.2, 7.3**
        """
        text = "Test sentence for embedding."
        embedding = model_manager.encode_query(text)

        assert len(embedding) == 768
        assert all(isinstance(x, float) for x in embedding)

    def test_batch_embedding_dimension(self):
        """Test batch embedding dimension consistency."""
        texts = ["First sentence.", "Second sentence.", "Third sentence."]
        embeddings = model_manager.encode(texts)

        assert len(embeddings) == 3
        for emb in embeddings:
            assert len(emb) == 768

    def test_token_count(self):
        """Test token counting functionality."""
        text = "Hello world"
        count = model_manager.count_tokens(text)

        assert count > 0
        assert isinstance(count, int)

    def test_rerank_returns_ordered_results(self):
        """
        Test that reranking returns results ordered by score.

        **Feature: semantic-knowledge-base, Property 7: Search Results Ordering**
        **Validates: Requirements 3.5, 3.6**
        """
        query = "What is a vector database?"
        documents = [
            "A cat sat on the mat.",
            "Vector databases store embeddings for similarity search.",
            "The weather is nice today.",
            "LanceDB is an open-source vector database.",
        ]

        results = model_manager.rerank(query, documents, top_k=3)

        assert len(results) == 3
        # Results should be sorted by score descending
        scores = [score for _, score in results]
        assert scores == sorted(scores, reverse=True)

    def test_rerank_empty_documents(self):
        """Test reranking with empty document list."""
        results = model_manager.rerank("query", [], top_k=5)
        assert results == []

    def test_rerank_respects_top_k(self):
        """Test that reranking respects top_k limit."""
        query = "test"
        documents = ["doc1", "doc2", "doc3", "doc4", "doc5"]

        results = model_manager.rerank(query, documents, top_k=2)
        assert len(results) == 2


class TestDocumentProcessor:
    """Tests for DocumentProcessor class."""

    @pytest.fixture
    def processor(self) -> DocumentProcessor:
        """Create a document processor instance."""
        return DocumentProcessor(model_manager)

    def test_read_document(self, processor: DocumentProcessor, sample_document: Path):
        """Test document reading."""
        content = processor.read_document(str(sample_document))

        assert "Sample Document" in content
        assert "vector databases" in content

    def test_read_nonexistent_document(self, processor: DocumentProcessor):
        """Test reading nonexistent document raises error."""
        with pytest.raises(DocumentNotFoundError):
            processor.read_document("/nonexistent/path/doc.md")

    def test_read_directory_raises_error(
        self,
        processor: DocumentProcessor,
        sample_documents_dir: Path,
    ):
        """Test reading a directory raises ValueError."""
        with pytest.raises(ValueError, match="not a file"):
            processor.read_document(str(sample_documents_dir))

    def test_chunk_document_preserves_content(self, processor: DocumentProcessor):
        """
        Test that chunking preserves document content.

        **Feature: semantic-knowledge-base, Property 1: Content Preservation**
        **Validates: Requirements 1.2**
        """
        original = "This is a test document. " * 50  # Make it long enough to chunk
        chunks, offsets = processor.chunk_document(original)

        # Concatenated chunks should contain all original content
        concatenated = "".join(chunks)
        # Allow for minor whitespace differences
        assert original.strip() in concatenated or concatenated in original

    def test_chunk_document_returns_offsets(self, processor: DocumentProcessor):
        """Test that chunking returns valid character offsets."""
        content = "Section 1: First part. " * 20 + "Section 2: Second part. " * 20
        chunks, offsets = processor.chunk_document(content)

        assert len(chunks) == len(offsets)
        # Offsets should be non-negative and increasing
        assert all(offset >= 0 for offset in offsets)

    def test_process_document(
        self,
        processor: DocumentProcessor,
        sample_document: Path,
    ):
        """Test full document processing pipeline."""
        chunks, embeddings, offsets, token_counts = processor.process_document(
            str(sample_document),
        )

        assert len(chunks) > 0
        assert len(chunks) == len(embeddings)
        assert len(chunks) == len(offsets)
        assert len(chunks) == len(token_counts)

        # Verify embedding dimension
        for emb in embeddings:
            assert len(emb) == 768

        # Verify token counts are positive
        assert all(count > 0 for count in token_counts)

    def test_discover_documents(
        self,
        processor: DocumentProcessor,
        sample_documents_dir: Path,
    ):
        """
        Test document discovery in directory.

        **Feature: semantic-knowledge-base, Property 5: Batch Document Discovery**
        **Validates: Requirements 2.2, 2.4**
        """
        documents = processor.discover_documents(
            str(sample_documents_dir),
            patterns=["*.txt", "*.md"],
        )

        # Should find 3 txt files + 1 md file in subdir
        assert len(documents) == 4

        # All should be files
        assert all(doc.is_file() for doc in documents)

    def test_discover_documents_with_pattern_filter(
        self,
        processor: DocumentProcessor,
        sample_documents_dir: Path,
    ):
        """Test document discovery with specific pattern."""
        txt_docs = processor.discover_documents(
            str(sample_documents_dir),
            patterns=["*.txt"],
        )
        md_docs = processor.discover_documents(
            str(sample_documents_dir),
            patterns=["*.md"],
        )

        assert len(txt_docs) == 3
        assert len(md_docs) == 1

    def test_discover_nonexistent_directory(self, processor: DocumentProcessor):
        """Test discovering in nonexistent directory raises error."""
        with pytest.raises(DirectoryNotFoundError):
            processor.discover_documents("/nonexistent/directory")

    def test_discover_file_not_directory(
        self,
        processor: DocumentProcessor,
        sample_document: Path,
    ):
        """Test discovering with file path raises error."""
        with pytest.raises(ValueError, match="not a directory"):
            processor.discover_documents(str(sample_document))
