---
trigger: glob
globs: *.py
---

backend/ API programming language is Python 3.13 using FastAPI
use uv package manager for all python operations for e.g. `uv run file.py` or `uv run pytest tests/`
Always use python 3.13 features and best practices like Type aliases (PEP 695)
Check for for formatting and linting errors by running `ruff format && ruff check --fix` commands after authoring a file
Use pytest as test framework