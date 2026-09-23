"""SQLite persistence only. Application rules belong to services.py."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Literal

Table = Literal['tasks', 'teams', 'proposals']
TABLES = ('tasks', 'teams', 'proposals')


class Repository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    @staticmethod
    def _table(table: Table) -> str:
        if table not in TABLES:
            raise ValueError('Unknown table')
        return table

    def all(self, table: Table) -> list[dict]:
        table = self._table(table)
        return [json.loads(row['payload']) for row in self.connection.execute(f'SELECT payload FROM {table} ORDER BY rowid')]

    def get(self, table: Table, item_id: str) -> dict | None:
        table = self._table(table)
        row = self.connection.execute(f'SELECT payload FROM {table} WHERE id=?', (item_id,)).fetchone()
        return json.loads(row['payload']) if row else None

    def insert(self, table: Table, item: dict) -> None:
        table = self._table(table)
        payload = json.dumps(item, ensure_ascii=False)
        if table == 'proposals':
            self.connection.execute(
                'INSERT INTO proposals (id, task_id, team_id, payload) VALUES (?, ?, ?, ?)',
                (item['id'], item['task_id'], item['team_id'], payload),
            )
        else:
            self.connection.execute(f'INSERT INTO {table} (id, payload) VALUES (?, ?)', (item['id'], payload))

    def update(self, table: Table, item: dict) -> None:
        table = self._table(table)
        self.connection.execute(
            f'UPDATE {table} SET payload=? WHERE id=?',
            (json.dumps(item, ensure_ascii=False), item['id']),
        )

    def is_seeded(self) -> bool:
        return self.connection.execute("SELECT 1 FROM metadata WHERE key='seed_version'").fetchone() is not None

    def mark_seeded(self) -> None:
        self.connection.execute("INSERT INTO metadata (key, value) VALUES ('seed_version', '1')")


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def session(self, *, write: bool = False) -> Iterator[Repository]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys=ON')
        try:
            connection.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
            yield Repository(connection)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        # Execute individual DDL statements: executescript would implicitly commit.
        statements = (
            'CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
            '''CREATE TABLE IF NOT EXISTS proposals (
                id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
                team_id TEXT NOT NULL REFERENCES teams(id), payload TEXT NOT NULL)''',
            'CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
        )
        with self.session(write=True) as repo:
            for statement in statements:
                repo.connection.execute(statement)
