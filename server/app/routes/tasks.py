from fastapi import APIRouter

from .. import services
from ..localization import Language
from ..rating import evaluate
from ..schemas import Category, EvaluateInput, Items, Level, Rating, SaveInput, Sort, Task
from .dependencies import DatabaseDep

router = APIRouter(tags=['tasks'])


@router.post('/tasks/evaluate', response_model=Rating)
def rate(body: EvaluateInput, locale: Language):
    return evaluate(body.card, locale)


@router.get('/tasks', response_model=Items[Task])
def tasks(database: DatabaseDep, locale: Language, category: Category | None = None,
          level: Level | None = None, sort: Sort = 'score_desc', include_drafts: bool = False):
    with database.session() as repo:
        return {'items': services.list_tasks(repo, category, level, sort, include_drafts, locale)}


@router.post('/tasks', response_model=Task, status_code=201)
def create_task(body: SaveInput, database: DatabaseDep, locale: Language):
    with database.session(write=True) as repo:
        return services.present_task(services.save_task(repo, body), locale)


@router.get('/tasks/{task_id}', response_model=Task)
def task(task_id: str, database: DatabaseDep, locale: Language):
    with database.session() as repo:
        return services.present_task(services.require(repo, 'tasks', task_id), locale)


@router.put('/tasks/{task_id}', response_model=Task)
def update_task(task_id: str, body: SaveInput, database: DatabaseDep, locale: Language):
    with database.session(write=True) as repo:
        return services.present_task(services.save_task(repo, body, task_id), locale)


@router.post('/tasks/{task_id}/publish', response_model=Task)
def publish(task_id: str, database: DatabaseDep, locale: Language):
    with database.session(write=True) as repo:
        return services.present_task(services.publish_task(repo, task_id), locale)
