"""Task and proposal lifecycle rules, independent of FastAPI and SQL."""
from datetime import datetime, timezone
from uuid import uuid4

from .db import Repository, Table
from .errors import AppError
from .localization import Locale
from .rating import evaluate, filled
from .schemas import Card, Category, DecisionInput, Level, Proposal, ProposalInput, ProposalReview, ReviewInput, SaveInput, Sort, Task

MILESTONE_POINTS = 50


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require(repo: Repository, table: Table, item_id: str) -> dict:
    item = repo.get(table, item_id)
    if item is None:
        raise AppError(404, 'not_found')
    return item


def present_task(task: dict, locale: Locale = 'ru') -> dict:
    # Messages follow the current request's locale, never the locale at save time.
    return {**task, 'rating': evaluate(Card.model_validate(task['card']), locale)}


def list_tasks(repo: Repository, category: Category | None, level: Level | None, sort: Sort, include_drafts: bool, locale: Locale) -> list[dict]:
    items = [
        present_task(task, locale) for task in repo.all('tasks')
        if (include_drafts or task['status'] == 'published')
        and (not category or task['card']['category'] == category)
    ]
    if level:
        items = [task for task in items if task['rating']['level'] == level]
    items.sort(
        key=lambda task: (task['rating']['score'], task['created_at']) if sort == 'score_desc' else task['created_at'],
        reverse=True,
    )
    return items


def save_task(repo: Repository, body: SaveInput, task_id: str | None = None) -> dict:
    if not body.confirmed:
        raise AppError(422, 'confirm')
    if task_id:
        task = require(repo, 'tasks', task_id)
        if task['status'] == 'published' and not filled(body.card.title):
            raise AppError(422, 'title_required')
        task.update(card=body.card.model_dump(), rating=evaluate(body.card), confirmed=True, updated_at=now())
        repo.update('tasks', task)
    else:
        timestamp = now()
        task = Task(
            id=f'task_{uuid4().hex[:12]}', card=body.card, rating=evaluate(body.card),
            confirmed=True, status='draft', created_at=timestamp, updated_at=timestamp,
        ).model_dump()
        repo.insert('tasks', task)
    return task


def publish_task(repo: Repository, task_id: str) -> dict:
    task = require(repo, 'tasks', task_id)
    if not task['confirmed'] or not filled(task['card']['title']):
        raise AppError(422, 'title_required')
    task.update(status='published', updated_at=now(), rating=evaluate(Card.model_validate(task['card'])))
    repo.update('tasks', task)
    return task


def task_proposals(repo: Repository, task_id: str) -> list[dict]:
    require(repo, 'tasks', task_id)
    return [proposal for proposal in repo.all('proposals') if proposal['task_id'] == task_id]


def create_proposal(repo: Repository, task_id: str, body: ProposalInput) -> dict:
    task = require(repo, 'tasks', task_id)
    require(repo, 'teams', body.team_id)
    if task['status'] != 'published':
        raise AppError(409, 'unpublished')
    proposal = Proposal(
        id=f'proposal_{uuid4().hex[:12]}', task_id=task_id, **body.model_dump(),
        status='pending', created_at=now(), milestone_confirmed=False, points=0,
    ).model_dump()
    repo.insert('proposals', proposal)
    return proposal


def decide_proposal(repo: Repository, proposal_id: str, body: DecisionInput) -> dict:
    proposal = require(repo, 'proposals', proposal_id)
    if proposal['status'] not in ('pending', body.status):
        raise AppError(409, 'decided')
    proposal['status'] = body.status
    repo.update('proposals', proposal)
    return proposal


def confirm_milestone(repo: Repository, proposal_id: str) -> dict:
    proposal = require(repo, 'proposals', proposal_id)
    if proposal['status'] != 'accepted':
        raise AppError(409, 'not_selected')
    if not proposal['milestone_confirmed']:
        proposal.update(milestone_confirmed=True, points=MILESTONE_POINTS)
        repo.update('proposals', proposal)
    return proposal


def review_proposal(repo: Repository, proposal_id: str, body: ReviewInput) -> dict:
    proposal = require(repo, 'proposals', proposal_id)
    if proposal['status'] != 'accepted' or not proposal['milestone_confirmed']:
        raise AppError(409, 'review_requires_completion')
    review = proposal.get('review')
    if review is not None:
        if review['rating'] != body.rating or review['comment'] != body.comment:
            raise AppError(409, 'review_exists')
        return proposal
    proposal['review'] = ProposalReview(**body.model_dump(), created_at=now()).model_dump()
    repo.update('proposals', proposal)
    return proposal
