from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from app.db import Database
from app.main import create_app
from app.seed import seed_database
from helpers import ApiTestCase


class LifecycleTest(ApiTestCase):
    def test_edit_removal_recalculates_without_unpublishing(self):
        task = self.new_task(context='Текущая ситуация', need='Улучшить процесс', data='Обезличенная таблица')
        self.client.post(f"/api/tasks/{task['id']}/publish")
        card = task['card'] | {'data': ' '}
        response = self.client.put(f"/api/tasks/{task['id']}", json={'card': card, 'confirmed': True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['rating']['score'], 20)
        self.assertEqual(response.json()['status'], 'published')
        self.assertIsNone(response.json()['card']['data'])
        self.assertIn('data', [f for item in response.json()['rating']['improvements'] for f in item['fields']])

    def test_confirmation_and_title_required(self):
        task = self.new_task()
        for confirmation in (False, 'true', 1, None):
            with self.subTest(confirmed=confirmation):
                response = self.client.put(f"/api/tasks/{task['id']}", json={'card': task['card'], 'confirmed': confirmation})
                self.assertEqual(response.status_code, 422)
        blank = self.new_task(title=None)
        self.assertEqual(self.client.post(f"/api/tasks/{blank['id']}/publish").status_code, 422)
        # Even a legacy unconfirmed record cannot be published by sending true here.
        with self.app.state.database.session(write=True) as repo:
            task['confirmed'] = False
            repo.update('tasks', task)
        self.assertEqual(self.client.post(f"/api/tasks/{task['id']}/publish", json={'confirmed': True}).status_code, 422)

    def test_low_rating_accepts_proposal_and_failed_edit_preserves_card(self):
        task = self.new_task()
        self.assertEqual(task['rating']['score'], 0)
        self.client.post(f"/api/tasks/{task['id']}/publish")
        self.assertEqual(self.new_proposal(task['id'])['status'], 'pending')
        url = f"/api/tasks/{task['id']}"
        before = self.client.get(url).json()
        response = self.client.put(url, json={'card': {**task['card'], 'title': None}, 'confirmed': True})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get(url).json(), before)

    def test_client_cannot_set_computed_task_fields(self):
        for field, value in (('score', 100), ('rating', {'score': 100}), ('status', 'published')):
            with self.subTest(field=field):
                response = self.client.post('/api/tasks', json={'card': {'title': 'Новая задача'}, 'confirmed': True, field: value})
                self.assertEqual(response.status_code, 422)
        response = self.client.post('/api/tasks/evaluate', json={'card': {'title': 'Новая задача'}, 'score': 100})
        self.assertEqual(response.status_code, 422)

    def test_client_cannot_set_proposal_points_or_status(self):
        body = {'team_id': 'team_1', 'idea': 'Новая идея', 'plan': 'Подробный план', 'deadline': '7 дней'}
        for field, value in (('status', 'accepted'), ('points', 50), ('milestone_confirmed', True)):
            with self.subTest(field=field):
                self.assertEqual(self.client.post('/api/tasks/task_reviews/proposals', json={**body, field: value}).status_code, 422)

    def test_decisions_independent_idempotent_and_not_automatic(self):
        task = self.new_task()
        self.client.post(f"/api/tasks/{task['id']}/publish")
        first = self.new_proposal(task['id'])
        second = self.new_proposal(task['id'], 'team_2')
        third = self.new_proposal(task['id'], 'team_3')
        self.assertTrue(all(p['status'] == 'pending' for p in (first, second, third)))
        for _ in range(2):
            self.assertEqual(self.client.patch(f"/api/proposals/{first['id']}", json={'status': 'accepted'}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/proposals/{first['id']}", json={'status': 'rejected'}).status_code, 409)
        items = self.client.get(f"/api/tasks/{task['id']}/proposals").json()['items']
        self.assertEqual([item['status'] for item in items], ['accepted', 'pending', 'pending'])
        self.assertEqual(self.client.patch(f"/api/proposals/{second['id']}", json={'status': 'accepted'}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/proposals/{third['id']}", json={'status': 'rejected'}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/proposals/{third['id']}/milestone").status_code, 409)

    def test_concurrent_milestone_awards_once(self):
        proposal = self.new_proposal('task_reviews')
        self.client.patch(f"/api/proposals/{proposal['id']}", json={'status': 'accepted'})
        url = f"/api/proposals/{proposal['id']}/milestone"
        with ThreadPoolExecutor(max_workers=6) as pool:
            responses = list(pool.map(lambda _: self.client.post(url), range(6)))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertTrue(all(response.json()['points'] == 50 for response in responses))
        self.assertTrue(all(response.json()['milestone_confirmed'] for response in responses))

    def test_concurrent_decisions_cannot_overwrite_each_other(self):
        proposal = self.new_proposal('task_reviews')
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(
                lambda status: self.client.patch(f"/api/proposals/{proposal['id']}", json={'status': status}),
                ('accepted', 'rejected'),
            ))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 409])

    def test_restart_preserves_edits_new_records_decisions_and_points(self):
        task = self.new_task(context='Содержимое, которое должно сохраниться')
        self.client.post(f"/api/tasks/{task['id']}/publish")
        proposal = self.new_proposal(task['id'])
        self.client.patch(f"/api/proposals/{proposal['id']}", json={'status': 'accepted'})
        self.client.post(f"/api/proposals/{proposal['id']}/milestone")
        seed_task = self.client.get('/api/tasks/task_reviews').json()
        seed_task['card']['need'] = 'Изменено человеком после первого запуска'
        self.client.put('/api/tasks/task_reviews', json={'card': seed_task['card'], 'confirmed': True})
        before_tasks = self.client.get('/api/tasks?include_drafts=true').json()
        before_proposals = self.client.get('/api/proposals').json()
        for _ in range(2):
            with TestClient(create_app(self.settings)) as restarted:
                self.assertEqual(restarted.get('/api/tasks?include_drafts=true').json(), before_tasks)
                self.assertEqual(restarted.get('/api/proposals').json(), before_proposals)

    def test_transaction_rolls_back_all_writes(self):
        database = self.app.state.database
        with self.assertRaises(RuntimeError):
            with database.session(write=True) as repo:
                repo.insert('tasks', {'id': 'rollback-test'})
                repo.insert('teams', {'id': 'rollback-team'})
                raise RuntimeError('abort')
        with database.session() as repo:
            self.assertIsNone(repo.get('tasks', 'rollback-test'))
            self.assertIsNone(repo.get('teams', 'rollback-team'))

    def test_existing_unmarked_database_is_not_seeded_over(self):
        with TemporaryDirectory(prefix='tubi-legacy-') as directory:
            database = Database(Path(directory) / 'existing.sqlite3')
            database.initialize()
            with database.session(write=True) as repo:
                repo.insert('teams', {'id': 'existing', 'name': 'Existing team'})
            seed_database(database)
            with database.session() as repo:
                self.assertEqual(repo.all('teams'), [{'id': 'existing', 'name': 'Existing team'}])
                self.assertEqual(repo.all('tasks'), [])
                self.assertTrue(repo.is_seeded())

    def test_localized_errors_and_rating_do_not_modify_content(self):
        for locale, fragment in (('ru', 'Запись'), ('kk', 'Жазба')):
            headers = {'Accept-Language': locale}
            response = self.client.get('/api/tasks/missing', headers=headers)
            self.assertEqual(response.status_code, 404)
            self.assertIn(fragment, response.json()['error']['message'])
            response = self.client.post('/api/tasks', json={}, headers=headers)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()['error']['code'], 'VALIDATION_ERROR')
            self.assertIn('card', response.json()['error']['fields'])
        task = self.new_task(context='Пользовательский текст на русском')
        ru = self.client.get(f"/api/tasks/{task['id']}").json()
        kk = self.client.get(f"/api/tasks/{task['id']}", headers={'Accept-Language': 'kk'}).json()
        self.assertEqual(ru['card'], kk['card'])
        self.assertEqual(ru['rating']['score'], kk['rating']['score'])
        self.assertNotEqual(ru['rating']['improvements'], kk['rating']['improvements'])

    def test_all_routes_declare_response_models(self):
        for route in self.app.routes:
            if getattr(route, 'path', '').startswith('/api/'):
                with self.subTest(path=route.path):
                    self.assertIsNotNone(route.response_model)
