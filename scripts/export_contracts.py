"""Regenerate example JSON and OpenAPI from the real backend definitions."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'server'))
from app.main import app
from app.ai import fallback
from app.rating import evaluate
from app.schemas import Card, PrepareInput

seed = json.loads((root / 'server/data/seed.json').read_text(encoding='utf-8'))
request = PrepareInput(stage='clarify', category='analytics', description='Отзывы читаем вручную и хотим ускорить работу.', answers=[])
tasks = []
for item in seed['tasks']:
    card = Card.model_validate(item['card'])
    tasks.append({**item, 'card': card.model_dump(), 'rating': evaluate(card), 'confirmed': True, 'status': 'published', 'created_at': '2026-09-23T08:00:00Z', 'updated_at': '2026-09-23T08:00:00Z'})
fixtures = {'prepare_request': request.model_dump(), 'prepare_response': fallback(request, 'Fixture: deterministic fallback.'), 'tasks_response': {'items': tasks}, 'teams_response': {'items': seed['teams']}, 'proposals_response': {'items': [{**p, 'status': 'pending', 'created_at': '2026-09-23T08:10:00Z', 'milestone_confirmed': False, 'points': 0} for p in seed['proposals']]}}
(root / 'contracts/fixtures.json').write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'contracts/openapi.json').write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Exported contracts/fixtures.json and contracts/openapi.json')
