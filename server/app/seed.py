"""Demo records are inserted once, and only into an empty database."""
import json

from .db import Database
from .rating import evaluate
from .schemas import Card, Proposal, Task, Team
from .settings import SERVER_DIR


def seed_records() -> dict[str, list[dict]]:
    seed = json.loads((SERVER_DIR / 'data' / 'seed.json').read_text(encoding='utf-8'))
    tasks = []
    for item in seed['tasks']:
        card = Card.model_validate(item['card'])
        task = Task(
            **item, rating=evaluate(card), confirmed=True, status='published',
            created_at='2026-09-23T08:00:00Z', updated_at='2026-09-23T08:00:00Z',
        )
        tasks.append(task.model_dump())
    proposals = [
        Proposal(**item, status='pending', created_at='2026-09-23T08:10:00Z', milestone_confirmed=False, points=0).model_dump()
        for item in seed['proposals']
    ]
    return {
        'tasks': tasks,
        'teams': [Team.model_validate(item).model_dump() for item in seed['teams']],
        'proposals': proposals,
    }


def seed_database(database: Database) -> None:
    with database.session(write=True) as repo:
        if repo.is_seeded():
            return
        # A pre-existing database without a marker must not be mixed with fixtures.
        if not any(repo.all(table) for table in ('tasks', 'teams', 'proposals')):
            for table, items in seed_records().items():
                for item in items:
                    repo.insert(table, item)
        repo.mark_seeded()
