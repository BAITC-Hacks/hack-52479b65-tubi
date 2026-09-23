"""Contract checks against a temporary database. No external API requests."""
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


class FlowTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='tubi-test-')
        self.env = patch.dict(os.environ, {'TUBI_DB_PATH': os.path.join(self.temp.name, 'test.sqlite3'), 'OPENAI_API_KEY': ''})
        self.env.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.temp.cleanup()

    def test_draft_to_manual_selection_and_milestone(self):
        payload = {'stage': 'clarify', 'category': 'analytics', 'description': 'Отзывы читаем вручную и хотим ускорить работу.', 'answers': []}
        response = self.client.post('/api/ai/prepare', json=payload)
        self.assertEqual(response.status_code, 200)
        prepared = response.json()
        self.assertEqual(prepared['mode'], 'fallback')
        self.assertGreaterEqual(len(prepared['questions']), 3)
        self.assertIsNone(prepared['card']['data'])
        before = self.client.post('/api/tasks/evaluate', json={'card': prepared['card']}).json()['score']
        answers = {'need': 'Группировать отзывы по темам', 'data': 'CSV из 100 обезличенных отзывов', 'expected_result': 'Таблица тем с примерами отзывов'}
        payload.update(stage='compose', answers=[{'question_id': q['id'], 'fields': q['fields'], 'question': q['text'], 'answer': answers[q['fields'][0]]} for q in prepared['questions']])
        card = self.client.post('/api/ai/prepare', json=payload).json()['card']
        task = self.client.post('/api/tasks', json={'card': card, 'confirmed': True}).json()
        self.assertGreater(task['rating']['score'], before)
        self.assertNotIn(task['id'], [t['id'] for t in self.client.get('/api/tasks').json()['items']])
        proposal = {'team_id': 'team_1', 'idea': 'Сгруппируем отзывы по темам', 'plan': 'Изучим CSV, соберём панель, покажем отчёт', 'deadline': '14 дней', 'prototype_url': None}
        self.assertEqual(self.client.post(f"/api/tasks/{task['id']}/proposals", json=proposal).status_code, 409)
        self.assertEqual(self.client.post(f"/api/tasks/{task['id']}/publish", json={}).status_code, 200)
        proposal_url = f"/api/tasks/{task['id']}/proposals"
        first = self.client.post(proposal_url, json=proposal).json()
        second = self.client.post(proposal_url, json={**proposal, 'team_id': 'team_2'}).json()
        self.assertEqual(first['status'], 'pending')
        self.assertEqual(self.client.patch(f"/api/proposals/{first['id']}", json={'status': 'accepted'}).json()['status'], 'accepted')
        items = self.client.get(proposal_url).json()['items']
        self.assertEqual(next(p for p in items if p['id'] == second['id'])['status'], 'pending')
        milestone = f"/api/proposals/{first['id']}/milestone"
        self.assertEqual(self.client.post(milestone).json()['points'], 50)
        self.assertEqual(self.client.post(milestone).json()['points'], 50)
        self.assertEqual(self.client.post(f"/api/proposals/{second['id']}/milestone").status_code, 409)

    def test_low_score_visibility_validation_and_recalculation(self):
        self.assertEqual(self.client.post('/api/tasks', json={'card': {'title': 'Проверка'}, 'confirmed': False}).status_code, 422)
        low = self.client.post('/api/tasks', json={'card': {'title': 'Новая задача'}, 'confirmed': True}).json()
        self.assertEqual(low['rating']['score'], 0)
        self.client.post(f"/api/tasks/{low['id']}/publish")
        published = self.client.get('/api/tasks').json()['items']
        self.assertIn(low['id'], [t['id'] for t in published])
        self.assertEqual([t['rating']['score'] for t in published], sorted([t['rating']['score'] for t in published], reverse=True))
        card = low['card'] | {'context': 'Отзывы читают вручную', 'need': 'Ускорить анализ', 'data': 'не знаю'}
        updated = self.client.put(f"/api/tasks/{low['id']}", json={'card': card, 'confirmed': True}).json()
        self.assertEqual(updated['rating']['score'], 20)
        self.assertEqual(updated['status'], 'published')
        bad = self.client.post('/api/tasks/task_reviews/proposals', json={'team_id': 'team_1', 'idea': 'Проверяем ссылку', 'plan': 'Проверяем безопасность URL', 'deadline': '7 дней', 'prototype_url': 'javascript:alert(1)'})
        self.assertEqual(bad.status_code, 422)
        self.assertIn('error', bad.json())

    def test_seed_is_persistent_and_filterable(self):
        self.assertEqual(len(self.client.get('/api/teams').json()['items']), 5)
        self.assertEqual(len(self.client.get('/api/proposals').json()['items']), 5)
        items = self.client.get('/api/tasks?category=analytics&level=priority').json()['items']
        self.assertTrue(items)
        self.assertTrue(all(t['card']['category'] == 'analytics' and t['rating']['score'] >= 90 for t in items))
        from app.db import initialize
        initialize()
        self.assertEqual(len(self.client.get('/api/tasks').json()['items']), 5)


if __name__ == '__main__':
    unittest.main()
