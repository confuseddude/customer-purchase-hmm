"""Point the app at a throwaway SQLite database before any app module is imported."""

import os
import sys
import tempfile
from pathlib import Path

os.environ["HMM_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "test.sqlite3")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
