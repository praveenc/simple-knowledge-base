"""
Property-based tests using Hypothesis.

These tests verify universal properties across many generated inputs,
as specified in the design document.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.services import DocumentProcessor, model_manager


class TestEmbeddingProperties:
    """Property-based tests for embedding generation."""

    @given(st.text(min_size=1, max_size=500))
    @settings(max_examples=50, deadline=None)
    def test_embedding_always_768_dimensions(self, text: str):
        """
        Property 3: Embedding Dimensionality Consistency.

        For any text processed by the embedding model, the resulting
        embedding vector should have exactly 768 dimensions.

        **Feature: semantic-knowledge-base, Property 3**
        **Validates: Requirements 1.4, 3.2, 7.3**
        """
        # Skip empty or whitespace-only strings
        if not text.strip():
            return

        embedding = model_manager.encode_query(text)

        assert len(embedding) == 768
        assert all(isinstance(x, float) for x in embedding)

    @given(st.lists(st.text(min_size=1, max_size=100), min_size=1, max_size=10))
    @settings(max_examples=30, deadline=None)
    def test_batch_embedding_consistent_dimensions(self, texts: list[str]):
        """
        Property 3: All batch embeddings have 768 dimensions.

        **Feature: semantic-knowledge-base, Property 3**
        **Validates: Requirements 1.4, 7.3**
        """
        # Filter out empty/whitespace texts
        valid_texts = [t for t in texts if t.strip()]
        if not valid_texts:
            return

        embeddings = model_manager.encode(valid_texts)

        assert len(embeddings) == len(valid_texts)
        for emb in embeddings:
            assert len(emb) == 768


class TestTokenCountProperties:
    """Property-based tests for token counting."""

    @given(st.text(min_size=0, max_size=1000))
    @settings(max_examples=50)
    def test_token_count_non_negative(self, text: str):
        """
        Token count should always be non-negative.

        **Feature: semantic-knowledge-base, Property 9: Chunk Token Count Accuracy**
        **Validates: Requirements 1.3, 1.6**
        """
        count = model_manager.count_tokens(text)
        assert count >= 0
        assert isinstance(count, int)

    @given(st.text(min_size=1, max_size=100))
    @settings(max_examples=30)
    def test_longer_text_more_tokens(self, base_text: str):
        """Longer text should generally have more or equal tokens."""
        if not base_text.strip():
            return

        short_count = model_manager.count_tokens(base_text)
        long_count = model_manager.count_tokens(base_text + " " + base_text)

        # Doubled text should have at least as many tokens
        assert long_count >= short_count


class TestRerankingProperties:
    """Property-based tests for reranking."""

    @given(
        st.text(min_size=5, max_size=100),
        st.lists(st.text(min_size=5, max_size=200), min_size=1, max_size=10),
        st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=30)
    def test_rerank_respects_top_k(self, query: str, documents: list[str], top_k: int):
        """
        Property 7: Reranking respects top_k limit.

        **Feature: semantic-knowledge-base, Property 7**
        **Validates: Requirements 3.5, 3.6**
        """
        # Filter empty documents
        valid_docs = [d for d in documents if d.strip()]
        if not valid_docs or not query.strip():
            return

        results = model_manager.rerank(query, valid_docs, top_k=top_k)

        # Results should not exceed top_k or document count
        assert len(results) <= min(top_k, len(valid_docs))

    @given(
        st.text(min_size=5, max_size=50),
        st.lists(st.text(min_size=10, max_size=100), min_size=2, max_size=5),
    )
    @settings(max_examples=30)
    def test_rerank_results_sorted_descending(self, query: str, documents: list[str]):
        """
        Property 7: Results are sorted by relevance descending.

        **Feature: semantic-knowledge-base, Property 7**
        **Validates: Requirements 3.5**
        """
        valid_docs = [d for d in documents if d.strip()]
        if len(valid_docs) < 2 or not query.strip():
            return

        results = model_manager.rerank(query, valid_docs, top_k=len(valid_docs))

        if len(results) > 1:
            scores = [score for _, score in results]
            assert scores == sorted(scores, reverse=True)


class TestChunkingProperties:
    """Property-based tests for document chunking."""

    @pytest.fixture
    def processor(self) -> DocumentProcessor:
        return DocumentProcessor(model_manager)

    @given(st.text(min_size=100, max_size=2000))
    @settings(max_examples=30)
    def test_chunking_produces_non_empty_chunks(self, text: str):
        """
        All chunks produced should be non-empty.

        **Feature: semantic-knowledge-base, Property 2**
        **Validates: Requirements 1.3**
        """
        if not text.strip():
            return

        processor = DocumentProcessor(model_manager)
        chunks, offsets = processor.chunk_document(text)

        # All chunks should be non-empty strings
        for chunk in chunks:
            assert len(chunk) > 0

    @given(st.text(min_size=100, max_size=2000))
    @settings(max_examples=30)
    def test_chunking_offsets_match_chunks(self, text: str):
        """
        Number of offsets should match number of chunks.

        **Feature: semantic-knowledge-base, Property 1**
        **Validates: Requirements 1.2**
        """
        if not text.strip():
            return

        processor = DocumentProcessor(model_manager)
        chunks, offsets = processor.chunk_document(text)

        assert len(chunks) == len(offsets)

    @given(st.text(min_size=50, max_size=1000))
    @settings(max_examples=30)
    def test_chunking_offsets_non_negative(self, text: str):
        """All chunk offsets should be non-negative."""
        if not text.strip():
            return

        processor = DocumentProcessor(model_manager)
        chunks, offsets = processor.chunk_document(text)

        for offset in offsets:
            assert offset >= 0


class TestInputValidationProperties:
    """Property-based tests for input validation."""

    @given(st.integers(min_value=-100, max_value=0))
    def test_invalid_top_k_rejected(self, top_k: int):
        """
        Property 10: Invalid top_k values should be rejected.

        **Feature: semantic-knowledge-base, Property 10**
        **Validates: Requirements 8.5**
        """
        from pydantic import ValidationError

        from app.models import QueryRequest

        with pytest.raises(ValidationError):
            QueryRequest(query="test", top_k=top_k)

    @given(st.integers(min_value=101, max_value=1000))
    def test_excessive_top_k_rejected(self, top_k: int):
        """Property 10: Excessive top_k values should be rejected."""
        from pydantic import ValidationError

        from app.models import QueryRequest

        with pytest.raises(ValidationError):
            QueryRequest(query="test", top_k=top_k)
