"""Application settings, loaded per app instance and never logged."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

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
        load_dotenv(SERVER_DIR / '.env')
        return cls(
            db_path=Path(os.getenv('TUBI_DB_PATH') or str(cls.db_path)),
            openai_api_key=os.getenv('OPENAI_API_KEY', '').strip(),
            openai_model=os.getenv('OPENAI_MODEL') or cls.openai_model,
        )
