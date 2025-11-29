"""Application configuration settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Semantic Knowledge Base"
    debug: bool = False

    # Database
    lancedb_path: str = "./data/lancedb"
    table_name: str = "chunks"

    # Models
    embedding_model: str = "Alibaba-NLP/gte-multilingual-base"
    reranker_model: str = "Alibaba-NLP/gte-multilingual-reranker-base"
    embedding_dimensions: int = 768

    # Chunking
    max_chunk_tokens: int = 512

    # Search
    default_top_k: int = 5
    vector_search_limit: int = 20  # Candidates to fetch before reranking

    # File patterns for batch processing
    default_file_patterns: list[str] = ["*.txt", "*.md", "*.rst", "*.py", "*.json"]

    model_config = SettingsConfigDict(
        env_prefix="KB_",
        env_file=".env",
    )

    @property
    def lancedb_uri(self) -> Path:
        """Get LanceDB URI as a Path object."""
        return Path(self.lancedb_path)


# Global settings instance
settings = Settings()
