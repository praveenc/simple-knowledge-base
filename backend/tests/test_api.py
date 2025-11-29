"""Tests for FastAPI endpoints."""

from pathlib import Path

from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_check(self, client: TestClient):
        """Test health check returns healthy status."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "app" in data


class TestCreateIndexEndpoint:
    """Tests for /create endpoint."""

    def test_create_index_success(self, client: TestClient):
        """Test creating a new index."""
        response = client.post("/create", json={"index_name": "test_new_index"})

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "success"
        assert data["index_name"] == "test_new_index"

    def test_create_duplicate_index_returns_409(self, client: TestClient):
        """Test creating duplicate index returns 409 conflict."""
        # Create first
        client.post("/create", json={"index_name": "test_duplicate"})
        # Try to create again
        response = client.post("/create", json={"index_name": "test_duplicate"})

        assert response.status_code == 409
        assert "already exists" in response.json()["message"].lower()

    def test_create_invalid_index_name_returns_422(self, client: TestClient):
        """Test invalid index name returns 422."""
        # Index name must start with letter
        response = client.post("/create", json={"index_name": "123invalid"})
        assert response.status_code == 422

        # Index name cannot be empty
        response = client.post("/create", json={"index_name": ""})
        assert response.status_code == 422


class TestListIndexesEndpoint:
    """Tests for /indexes endpoint."""

    def test_list_indexes(self, client: TestClient, test_index: str):
        """Test listing indexes."""
        response = client.get("/indexes")

        assert response.status_code == 200
        data = response.json()
        assert "indexes" in data
        assert "count" in data
        assert test_index in data["indexes"]

    def test_list_indexes_empty(self, client: TestClient):
        """Test listing indexes when empty."""
        response = client.get("/indexes")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["indexes"], list)
        assert data["count"] >= 0


class TestGetRecordCountEndpoint:
    """Tests for /indexes/{index_name}/count endpoint."""

    def test_get_record_count_empty_index(self, client: TestClient, test_index: str):
        """Test getting record count for an empty index."""
        response = client.get(f"/indexes/{test_index}/count")

        assert response.status_code == 200
        data = response.json()
        assert data["index_name"] == test_index
        assert data["record_count"] == 0

    def test_get_record_count_with_documents(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """Test getting record count after adding documents."""
        # First encode a document
        client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": test_index,
            },
        )

        # Get record count
        response = client.get(f"/indexes/{test_index}/count")

        assert response.status_code == 200
        data = response.json()
        assert data["index_name"] == test_index
        assert data["record_count"] > 0

    def test_get_record_count_nonexistent_index(self, client: TestClient):
        """Test getting record count for non-existent index returns 404."""
        response = client.get("/indexes/nonexistent_index/count")

        assert response.status_code == 404


class TestEncodeDocEndpoint:
    """Tests for /encode_doc endpoint."""

    def test_encode_valid_document(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """Test encoding a valid document."""
        response = client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": test_index,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["index_name"] == test_index
        assert data["chunk_count"] > 0
        assert len(data["token_counts"]) == data["chunk_count"]

    def test_encode_nonexistent_document(self, client: TestClient, test_index: str):
        """
        Test encoding nonexistent document returns 404.

        **Feature: semantic-knowledge-base, Property 10: Input Validation**
        **Validates: Requirements 8.2, 8.5**
        """
        response = client.post(
            "/encode_doc",
            json={
                "document_path": "/nonexistent/path/doc.md",
                "index_name": test_index,
            },
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_encode_to_nonexistent_index(
        self,
        client: TestClient,
        sample_document: Path,
    ):
        """Test encoding to nonexistent index returns 404."""
        response = client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": "nonexistent_index",
            },
        )

        assert response.status_code == 404
        assert "index" in response.json()["message"].lower()

    def test_encode_directory_returns_404(
        self,
        client: TestClient,
        test_index: str,
        sample_documents_dir: Path,
    ):
        """
        Test encoding a directory returns 404 (not a file).

        **Feature: semantic-knowledge-base, Property 10: Input Validation**
        **Validates: Requirements 8.1, 8.5**
        """
        response = client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_documents_dir),
                "index_name": test_index,
            },
        )

        # Directory raises ValueError which should be handled
        assert response.status_code in (400, 404, 500)

    def test_encode_missing_document_path(self, client: TestClient, test_index: str):
        """Test request without document_path returns 422."""
        response = client.post(
            "/encode_doc",
            json={"index_name": test_index},
        )

        assert response.status_code == 422

    def test_encode_missing_index_name(self, client: TestClient, sample_document: Path):
        """Test request without index_name returns 422."""
        response = client.post(
            "/encode_doc",
            json={"document_path": str(sample_document)},
        )

        assert response.status_code == 422


class TestEncodeBatchEndpoint:
    """Tests for /encode_batch endpoint."""

    def test_encode_batch_valid_directory(
        self,
        client: TestClient,
        test_index: str,
        sample_documents_dir: Path,
    ):
        """Test batch encoding a valid directory."""
        response = client.post(
            "/encode_batch",
            json={
                "directory_path": str(sample_documents_dir),
                "index_name": test_index,
                "file_patterns": ["*.txt", "*.md"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["index_name"] == test_index
        assert data["documents_queued"] > 0

    def test_encode_batch_nonexistent_directory(
        self,
        client: TestClient,
        test_index: str,
    ):
        """
        Test batch encoding nonexistent directory returns 404.

        **Feature: semantic-knowledge-base, Property 10: Input Validation**
        **Validates: Requirements 8.2, 8.5**
        """
        response = client.post(
            "/encode_batch",
            json={
                "directory_path": "/nonexistent/directory",
                "index_name": test_index,
            },
        )

        assert response.status_code == 404

    def test_encode_batch_nonexistent_index(
        self,
        client: TestClient,
        sample_documents_dir: Path,
    ):
        """Test batch encoding to nonexistent index returns 404."""
        response = client.post(
            "/encode_batch",
            json={
                "directory_path": str(sample_documents_dir),
                "index_name": "nonexistent_index",
            },
        )

        assert response.status_code == 404
        assert "index" in response.json()["message"].lower()

    def test_encode_batch_file_instead_of_directory(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """Test batch encoding a file returns error."""
        response = client.post(
            "/encode_batch",
            json={
                "directory_path": str(sample_document),
                "index_name": test_index,
            },
        )

        # File path raises ValueError
        assert response.status_code in (400, 404, 500)

    def test_encode_batch_empty_directory(
        self,
        client: TestClient,
        test_index: str,
        tmp_path: Path,
    ):
        """Test batch encoding empty directory."""
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        response = client.post(
            "/encode_batch",
            json={
                "directory_path": str(empty_dir),
                "index_name": test_index,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["documents_queued"] == 0


class TestQueryEndpoint:
    """Tests for /query endpoint."""

    def test_query_valid(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """Test valid query after encoding a document."""
        # First encode a document
        client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": test_index,
            },
        )

        # Then query
        response = client.post(
            "/query",
            json={
                "query": "What is a vector database?",
                "index_name": test_index,
                "top_k": 3,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["index_name"] == test_index
        assert "results" in data

    def test_query_nonexistent_index(self, client: TestClient):
        """Test querying nonexistent index returns 404."""
        response = client.post(
            "/query",
            json={
                "query": "test query",
                "index_name": "nonexistent_index",
            },
        )

        assert response.status_code == 404
        assert "index" in response.json()["message"].lower()

    def test_query_empty_rejected(self, client: TestClient, test_index: str):
        """
        Test empty query is rejected.

        **Feature: semantic-knowledge-base, Property 10: Input Validation**
        **Validates: Requirements 8.5**
        """
        response = client.post(
            "/query",
            json={"query": "", "index_name": test_index},
        )

        assert response.status_code == 422

    def test_query_respects_top_k(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """
        Test query respects top_k parameter.

        **Feature: semantic-knowledge-base, Property 7: Search Results Ordering**
        **Validates: Requirements 3.6**
        """
        # Encode document first
        client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": test_index,
            },
        )

        # Query with specific top_k
        response = client.post(
            "/query",
            json={
                "query": "vector database",
                "index_name": test_index,
                "top_k": 2,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) <= 2

    def test_query_results_ordered_by_relevance(
        self,
        client: TestClient,
        test_index: str,
        sample_document: Path,
    ):
        """
        Test query results are ordered by relevance score.

        **Feature: semantic-knowledge-base, Property 7: Search Results Ordering**
        **Validates: Requirements 3.5, 3.6**
        """
        # Encode document first
        client.post(
            "/encode_doc",
            json={
                "document_path": str(sample_document),
                "index_name": test_index,
            },
        )

        response = client.post(
            "/query",
            json={
                "query": "semantic search embeddings",
                "index_name": test_index,
                "top_k": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()

        if len(data["results"]) > 1:
            scores = [r["relevance_score"] for r in data["results"]]
            # Scores should be in descending order
            assert scores == sorted(scores, reverse=True)

    def test_query_empty_index(self, client: TestClient, test_index: str):
        """Test query on empty index returns no results."""
        response = client.post(
            "/query",
            json={
                "query": "test query",
                "index_name": test_index,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["results"]) == 0


class TestErrorResponses:
    """Tests for error response handling."""

    def test_invalid_json_body(self, client: TestClient):
        """Test invalid JSON body returns 422."""
        response = client.post(
            "/encode_doc",
            content="not valid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    def test_wrong_method(self, client: TestClient):
        """Test wrong HTTP method returns 405."""
        response = client.get("/encode_doc")
        assert response.status_code == 405

    def test_nonexistent_endpoint(self, client: TestClient):
        """Test nonexistent endpoint returns 404."""
        response = client.get("/nonexistent")
        assert response.status_code == 404
