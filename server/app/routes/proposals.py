from fastapi import APIRouter

from .. import services
from ..schemas import DecisionInput, Items, Proposal, ProposalInput, ReviewInput, Team
from .dependencies import DatabaseDep

router = APIRouter(tags=['proposals'])


@router.get('/teams', response_model=Items[Team])
def teams(database: DatabaseDep):
    with database.session() as repo:
        return {'items': repo.all('teams')}


@router.get('/proposals', response_model=Items[Proposal])
def proposals(database: DatabaseDep):
    with database.session() as repo:
        return {'items': repo.all('proposals')}


@router.get('/tasks/{task_id}/proposals', response_model=Items[Proposal])
def task_proposals(task_id: str, database: DatabaseDep):
    with database.session() as repo:
        return {'items': services.task_proposals(repo, task_id)}


@router.post('/tasks/{task_id}/proposals', response_model=Proposal, status_code=201)
def create_proposal(task_id: str, body: ProposalInput, database: DatabaseDep):
    with database.session(write=True) as repo:
        return services.create_proposal(repo, task_id, body)


@router.patch('/proposals/{proposal_id}', response_model=Proposal)
def decide(proposal_id: str, body: DecisionInput, database: DatabaseDep):
    with database.session(write=True) as repo:
        return services.decide_proposal(repo, proposal_id, body)


@router.post('/proposals/{proposal_id}/milestone', response_model=Proposal)
def milestone(proposal_id: str, database: DatabaseDep):
    with database.session(write=True) as repo:
        return services.confirm_milestone(repo, proposal_id)


@router.post('/proposals/{proposal_id}/review', response_model=Proposal)
def review(proposal_id: str, body: ReviewInput, database: DatabaseDep):
    with database.session(write=True) as repo:
        return services.review_proposal(repo, proposal_id, body)
