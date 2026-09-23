import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from . import ai, db
from .rating import evaluate, filled
from .schemas import Category, DecisionInput, EvaluateInput, PrepareInput, ProposalInput, SaveInput

load_dotenv(Path(__file__).resolve().parents[1] / '.env')


@asynccontextmanager
async def lifespan(app):
    db.initialize()
    yield


app = FastAPI(title='Tubi API', version='0.1.0', lifespan=lifespan)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={'error': {'code': f'HTTP_{exc.status_code}', 'message': str(exc.detail), 'fields': []}})


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    fields = ['.'.join(str(part) for part in error['loc'] if part != 'body') for error in exc.errors()]
    return JSONResponse(status_code=422, content={'error': {'code': 'VALIDATION_ERROR', 'message': 'Проверьте заполнение полей: ' + ', '.join(fields), 'fields': fields}})


def require(table, item_id):
    item = db.get_item(table, item_id)
    if item is None:
        raise HTTPException(404, 'Запись не найдена.')
    return item


def now():
    return datetime.now(timezone.utc).isoformat()


@app.get('/api/health')
def health():
    return {'status': 'ok', 'ai_mode': 'live' if os.getenv('OPENAI_API_KEY') else 'fallback'}


@app.post('/api/ai/prepare')
def prepare(body: PrepareInput):
    return ai.prepare(body)


@app.post('/api/tasks/evaluate')
def rate(body: EvaluateInput):
    return evaluate(body.card)


@app.get('/api/tasks')
def tasks(category: Category | None = None, level: str | None = Query(None, pattern='^(draft|working|ready|priority)$'), sort: str = Query('score_desc', pattern='^(score_desc|newest)$'), include_drafts: bool = False):
    items = [t for t in db.all_items('tasks') if (include_drafts or t['status'] == 'published') and (not category or t['card']['category'] == category) and (not level or t['rating']['level'] == level)]
    items.sort(key=lambda t: (t['rating']['score'], t['created_at']) if sort == 'score_desc' else t['created_at'], reverse=True)
    return {'items': items}


@app.post('/api/tasks', status_code=201)
def create_task(body: SaveInput):
    if not body.confirmed:
        raise HTTPException(422, 'Подтвердите сведения в карточке.')
    task = {'id': f'task_{uuid4().hex[:12]}', 'card': body.card.model_dump(), 'rating': evaluate(body.card), 'confirmed': True, 'status': 'draft', 'created_at': now(), 'updated_at': now()}
    with db.connection() as conn:
        conn.execute('INSERT INTO tasks VALUES (?, ?)', (task['id'], db.encode(task)))
    return task


@app.get('/api/tasks/{task_id}')
def task(task_id: str):
    return require('tasks', task_id)


@app.put('/api/tasks/{task_id}')
def update_task(task_id: str, body: SaveInput):
    if not body.confirmed:
        raise HTTPException(422, 'Подтвердите изменённую карточку.')
    task = require('tasks', task_id)
    if task['status'] == 'published' and not filled(body.card.title):
        raise HTTPException(422, 'У опубликованной задачи должно быть название.')
    task.update(card=body.card.model_dump(), rating=evaluate(body.card), confirmed=True, updated_at=now())
    with db.connection() as conn:
        conn.execute('UPDATE tasks SET payload=? WHERE id=?', (db.encode(task), task_id))
    return task


@app.post('/api/tasks/{task_id}/publish')
def publish(task_id: str):
    task = require('tasks', task_id)
    if not task['confirmed'] or not filled(task['card']['title']):
        raise HTTPException(422, 'Укажите название и подтвердите карточку.')
    task.update(status='published', updated_at=now())
    with db.connection() as conn:
        conn.execute('UPDATE tasks SET payload=? WHERE id=?', (db.encode(task), task_id))
    return task


@app.get('/api/teams')
def teams():
    return {'items': db.all_items('teams')}


@app.get('/api/proposals')
def proposals():
    return {'items': db.all_items('proposals')}


@app.get('/api/tasks/{task_id}/proposals')
def task_proposals(task_id: str):
    require('tasks', task_id)
    return {'items': [p for p in db.all_items('proposals') if p['task_id'] == task_id]}


@app.post('/api/tasks/{task_id}/proposals', status_code=201)
def create_proposal(task_id: str, body: ProposalInput):
    task = require('tasks', task_id)
    require('teams', body.team_id)
    if task['status'] != 'published':
        raise HTTPException(409, 'Откликнуться можно после публикации задачи.')
    proposal = {'id': f'proposal_{uuid4().hex[:12]}', 'task_id': task_id, **body.model_dump(), 'status': 'pending', 'created_at': now(), 'milestone_confirmed': False, 'points': 0}
    with db.connection() as conn:
        conn.execute('INSERT INTO proposals VALUES (?, ?, ?, ?)', (proposal['id'], task_id, body.team_id, db.encode(proposal)))
    return proposal


@app.patch('/api/proposals/{proposal_id}')
def decide(proposal_id: str, body: DecisionInput):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('SELECT payload FROM proposals WHERE id=?', (proposal_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Отклик не найден.')
        proposal = json.loads(row['payload'])
        if proposal['status'] not in ('pending', body.status):
            raise HTTPException(409, 'Решение по этому отклику уже принято.')
        proposal['status'] = body.status
        conn.execute('UPDATE proposals SET payload=? WHERE id=?', (db.encode(proposal), proposal_id))
    return proposal


@app.post('/api/proposals/{proposal_id}/milestone')
def milestone(proposal_id: str):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('SELECT payload FROM proposals WHERE id=?', (proposal_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Отклик не найден.')
        proposal = json.loads(row['payload'])
        if proposal['status'] != 'accepted':
            raise HTTPException(409, 'Сначала выберите эту команду.')
        proposal.update(milestone_confirmed=True, points=50)
        conn.execute('UPDATE proposals SET payload=? WHERE id=?', (db.encode(proposal), proposal_id))
    return proposal


# npm run build enables a single-server demo at http://127.0.0.1:8000.
dist = Path(__file__).resolve().parents[2] / 'web' / 'dist'
if dist.is_dir():
    app.mount('/', StaticFiles(directory=dist, html=True), name='web')
