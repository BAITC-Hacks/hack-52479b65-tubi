import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from .schemas import Card
from .rating import evaluate

SERVER_DIR = Path(__file__).resolve().parents[1]


@contextmanager
def connection():
    path = Path(os.getenv('TUBI_DB_PATH', str(SERVER_DIR / 'data' / 'tubi.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def encode(value):
    return json.dumps(value, ensure_ascii=False)


def initialize():
    with connection() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS proposals (
                id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
                team_id TEXT NOT NULL REFERENCES teams(id), payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        if db.execute("SELECT value FROM metadata WHERE key='seed_version'").fetchone():
            return
        seed = json.loads((SERVER_DIR / 'data' / 'seed.json').read_text(encoding='utf-8'))
        for task in seed['tasks']:
            card = Card.model_validate(task['card'])
            task.update(card=card.model_dump(), rating=evaluate(card), confirmed=True, status='published', created_at='2026-09-23T08:00:00Z', updated_at='2026-09-23T08:00:00Z')
            db.execute('INSERT OR IGNORE INTO tasks VALUES (?, ?)', (task['id'], encode(task)))
        for team in seed['teams']:
            db.execute('INSERT OR IGNORE INTO teams VALUES (?, ?)', (team['id'], encode(team)))
        for proposal in seed['proposals']:
            proposal.update(status='pending', created_at='2026-09-23T08:10:00Z', milestone_confirmed=False, points=0)
            db.execute('INSERT OR IGNORE INTO proposals VALUES (?, ?, ?, ?)', (proposal['id'], proposal['task_id'], proposal['team_id'], encode(proposal)))
        db.execute("INSERT INTO metadata VALUES ('seed_version', '1')")


def all_items(table: str) -> list[dict]:
    if table not in ('tasks', 'teams', 'proposals'):
        raise ValueError('Unknown table')
    with connection() as db:
        return [json.loads(row['payload']) for row in db.execute(f'SELECT payload FROM {table}')]


def get_item(table: str, item_id: str) -> dict | None:
    if table not in ('tasks', 'teams', 'proposals'):
        raise ValueError('Unknown table')
    with connection() as db:
        row = db.execute(f'SELECT payload FROM {table} WHERE id=?', (item_id,)).fetchone()
        return json.loads(row['payload']) if row else None
