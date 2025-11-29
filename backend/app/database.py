"""LanceDB database connection and operations."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

import lancedb
from loguru import logger

if TYPE_CHECKING:
    from lancedb.table import Table

from app.config import settings
from app.exceptions import IndexAlreadyExistsError, IndexNotFoundError
from app.models import ChunkSchema

# =============================================================================
# Type Aliases (PEP 695 - Python 3.12+)
# =============================================================================

type Embedding = list[float]
type EmbeddingBatch = list[Embedding]
type SearchResults = list[dict]


class LanceDBManager:
    """Manager for LanceDB operations with multi-index support."""

    def __init__(self) -> None:
        """Initialize the database manager."""
        self._db: lancedb.DBConnection | None = None
        self._tables: dict[str, Table] = {}

    def connect(self) -> lancedb.DBConnection:
        """
        Establish connection to LanceDB.

        Returns:
            LanceDB connection instance.

        """
        if self._db is None:
            logger.info(f"Connecting to LanceDB at {settings.lancedb_uri}")
            settings.lancedb_uri.mkdir(parents=True, exist_ok=True)
            self._db = lancedb.connect(settings.lancedb_uri)
            logger.info("LanceDB connection established")
        return self._db

    def create_index(self, index_name: str) -> bool:
        """
        Create a new index (table) in the database.

        Args:
            index_name: Name of the index to create.

        Returns:
            True if created successfully.

        Raises:
            IndexAlreadyExistsError: If index already exists.

        """
        db = self.connect()

        if index_name in db.table_names():
            raise IndexAlreadyExistsError(index_name)

        logger.info(f"Creating new index: {index_name}")
        table = db.create_table(index_name, schema=ChunkSchema)
        self._tables[index_name] = table
        logger.info(f"Index created successfully: {index_name}")
        return True

    def index_exists(self, index_name: str) -> bool:
        """
        Check if an index exists.

        Args:
            index_name: Name of the index to check.

        Returns:
            True if index exists, False otherwise.

        """
        db = self.connect()
        return index_name in db.table_names()

    def list_indexes(self) -> list[str]:
        """
        List all available indexes.

        Returns:
            List of index names.

        """
        db = self.connect()
        return db.table_names()

    def _get_table(self, index_name: str) -> Table:
        """
        Get a table by index name, with caching.

        Args:
            index_name: Name of the index.

        Returns:
            LanceDB table instance.

        Raises:
            IndexNotFoundError: If index does not exist.

        """
        # Check cache first
        if index_name in self._tables:
            return self._tables[index_name]

        db = self.connect()

        if index_name not in db.table_names():
            raise IndexNotFoundError(index_name)

        logger.debug(f"Opening table: {index_name}")
        table = db.open_table(index_name)
        self._tables[index_name] = table
        return table

    def add_chunks(  # noqa: PLR0913
        self,
        index_name: str,
        contents: list[str],
        embeddings: EmbeddingBatch,
        source_document: str,
        chunk_offsets: list[int],
        token_counts: list[int],
    ) -> int:
        """
        Add chunks with embeddings to a specific index.

        Args:
            index_name: Name of the target index.
            contents: List of chunk text contents.
            embeddings: List of embedding vectors (768-dim each).
            source_document: Source document identifier.
            chunk_offsets: Character offsets for each chunk.
            token_counts: Token counts for each chunk.

        Returns:
            Number of chunks added.

        Raises:
            IndexNotFoundError: If index does not exist.

        """
        table = self._get_table(index_name)

        chunks = [
            ChunkSchema(
                chunk_id=str(uuid4()),
                content=content,
                embedding=embedding,
                source_document=source_document,
                chunk_offset=offset,
                token_count=token_count,
                created_at=datetime.now(tz=UTC),
            )
            for content, embedding, offset, token_count in zip(
                contents,
                embeddings,
                chunk_offsets,
                token_counts,
                strict=True,
            )
        ]

        table.add([chunk.model_dump() for chunk in chunks])
        logger.info(
            f"Added {len(chunks)} chunks to '{index_name}' from {source_document}",
        )

        return len(chunks)

    def vector_search(
        self,
        index_name: str,
        query_embedding: Embedding,
        limit: int = 20,
    ) -> SearchResults:
        """
        Perform vector similarity search on a specific index.

        Args:
            index_name: Name of the index to search.
            query_embedding: Query embedding vector (768-dim).
            limit: Maximum number of results to return.

        Returns:
            List of matching chunks with scores.

        Raises:
            IndexNotFoundError: If index does not exist.

        """
        table = self._get_table(index_name)

        results = table.search(query_embedding).limit(limit).to_list()

        logger.debug(
            f"Vector search on '{index_name}' returned {len(results)} candidates",
        )
        return results

    def count_rows(self, index_name: str) -> int:
        """
        Count the number of rows in an index.

        Args:
            index_name: Name of the index.

        Returns:
            Number of rows in the index.

        Raises:
            IndexNotFoundError: If index does not exist.

        """
        table = self._get_table(index_name)
        return table.count_rows()

    def delete_index(self, index_name: str) -> bool:
        """
        Delete an index from the database.

        Args:
            index_name: Name of the index to delete.

        Returns:
            True if deleted successfully.

        Raises:
            IndexNotFoundError: If index does not exist.

        """
        db = self.connect()

        if index_name not in db.table_names():
            raise IndexNotFoundError(index_name)

        logger.info(f"Deleting index: {index_name}")
        db.drop_table(index_name)

        # Remove from cache
        if index_name in self._tables:
            del self._tables[index_name]

        logger.info(f"Index deleted: {index_name}")
        return True

    def close(self) -> None:
        """Close the database connection."""
        if self._db is not None:
            logger.info("Closing LanceDB connection")
            self._db = None
            self._tables.clear()


# Global database manager instance
db_manager = LanceDBManager()
