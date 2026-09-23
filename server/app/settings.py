"""Application settings, loaded per app instance and never logged."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values

SERVER_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = SERVER_DIR.parent


@dataclass(frozen=True)
class Settings:
    db_path: Path = SERVER_DIR / 'data' / 'tubi.sqlite3'
    openai_api_key: str = field(default='', repr=False)
    openai_model: str = 'gpt-4o-mini'
    ai_timeout: float = 20.0

    @classmethod
    def from_env(cls) -> 'Settings':
        # Do not mutate os.environ: a later app instance must read fresh values.
        # Explicit process variables take precedence, including an empty API key.
        values = {**dotenv_values(SERVER_DIR / '.env', encoding='utf-8-sig'), **os.environ}
        db_path = Path((values.get('TUBI_DB_PATH') or '').strip() or str(cls.db_path)).expanduser()
        if not db_path.is_absolute():
            db_path = PROJECT_DIR / db_path
        return cls(
            db_path=db_path.resolve(),
            openai_api_key=(values.get('OPENAI_API_KEY') or '').strip(),
            openai_model=(values.get('OPENAI_MODEL') or '').strip() or cls.openai_model,
        )
