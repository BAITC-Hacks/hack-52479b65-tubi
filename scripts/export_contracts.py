"""Regenerate public examples and OpenAPI without a database or provider request."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'server'))

from app.ai import fallback
from app.main import create_app
from app.schemas import PrepareInput, ProposalReview, ReviewInput
from app.seed import seed_records
from app.services import MILESTONE_POINTS


def export() -> None:
    request = PrepareInput(
        stage='clarify', category='analytics',
        description='Мы вручную читаем отзывы гостей кофейни в Алматы.', answers=[],
    )
    responses = {locale: fallback(request, locale=locale) for locale in ('ru', 'kk')}
    answer_text = {
        'need': 'Группировать отзывы по темам',
        'data': 'CSV из 100 обезличенных отзывов',
        'expected_result': 'Таблица тем с примерами отзывов',
    }
    compose = PrepareInput.model_validate({**request.model_dump(),
        'stage': 'compose',
        'answers': [
            {'question_id': question['id'], 'fields': question['fields'],
             'question': question['text'], 'answer': answer_text[question['fields'][0]]}
            for question in responses['ru']['questions']
        ],
    })
    records = seed_records()
    review = ReviewInput(rating=5, comment='Команда передала понятный прототип и учла обратную связь.')
    fixtures = {
        'prepare_request': request.model_dump(),
        'prepare_response': responses['ru'],
        'prepare_request_headers_kk': {'Accept-Language': 'kk'},
        'prepare_response_kk': responses['kk'],
        'compose_request': compose.model_dump(),
        'compose_response': fallback(compose),
        'tasks_response': {'items': records['tasks']},
        'teams_response': {'items': records['teams']},
        'proposals_response': {'items': records['proposals']},
        'review_request': review.model_dump(),
        'reviewed_proposal_response': {
            **records['proposals'][0], 'status': 'accepted',
            'milestone_confirmed': True, 'points': MILESTONE_POINTS,
            'review': ProposalReview(**review.model_dump(), created_at='2026-09-23T09:00:00Z').model_dump(),
        },
    }
    for name, payload in (('fixtures.json', fixtures), ('openapi.json', create_app().openapi())):
        (root / 'contracts' / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Exported contracts/fixtures.json and contracts/openapi.json')


if __name__ == '__main__':
    export()
