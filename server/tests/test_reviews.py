from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from fastapi.testclient import TestClient

from app.main import create_app
from helpers import ApiTestCase


class ReviewTest(ApiTestCase):
    def completed_proposal(self):
        proposal = self.new_proposal('task_reviews')
        url = f"/api/proposals/{proposal['id']}"
        self.assertEqual(self.client.patch(url, json={'status': 'accepted'}).status_code, 200)
        self.assertEqual(self.client.post(f'{url}/milestone').status_code, 200)
        return proposal

    def test_review_is_trimmed_visible_and_does_not_change_points(self):
        for rating in (1, 5):
            with self.subTest(rating=rating):
                proposal = self.completed_proposal()
                response = self.client.post(f"/api/proposals/{proposal['id']}/review", json={
                    'rating': rating, 'comment': '  Команда учла обратную связь. \n',
                }, headers={'Accept-Language': 'kk'})
                self.assertEqual(response.status_code, 200, response.text)
                saved = response.json()
                self.assertEqual(saved['review']['rating'], rating)
                self.assertEqual(saved['review']['comment'], 'Команда учла обратную связь.')
                self.assertIsNotNone(datetime.fromisoformat(saved['review']['created_at']).tzinfo)
                self.assertEqual(saved['points'], 50)
                for path in ('/api/proposals', '/api/tasks/task_reviews/proposals'):
                    visible = next(item for item in self.client.get(path).json()['items'] if item['id'] == proposal['id'])
                    self.assertEqual(visible, saved)
                milestone = self.client.post(f"/api/proposals/{proposal['id']}/milestone").json()
                self.assertEqual(milestone, saved)

    def test_review_requires_selection_and_completion_with_localized_errors(self):
        proposal = self.new_proposal('task_reviews')
        url = f"/api/proposals/{proposal['id']}"
        for status in ('pending', 'accepted', 'rejected'):
            with self.app.state.database.session(write=True) as repo:
                stored = repo.get('proposals', proposal['id'])
                stored.update(status=status, milestone_confirmed=status == 'rejected')
                repo.update('proposals', stored)
            for locale, fragment in (('ru', 'подтверждения'), ('kk', 'растағаннан')):
                with self.subTest(status=status, locale=locale):
                    response = self.client.post(f'{url}/review', json={'rating': 5, 'comment': 'Хорошая работа'},
                                                headers={'Accept-Language': locale})
                    self.assertEqual(response.status_code, 409)
                    self.assertIn(fragment, response.json()['error']['message'])
            with self.app.state.database.session() as repo:
                self.assertIsNone(repo.get('proposals', proposal['id'])['review'])

    def test_review_rejects_invalid_values_and_client_owned_metadata(self):
        proposal = self.completed_proposal()
        valid = {'rating': 5, 'comment': 'Хорошая работа'}
        invalid = [
            *({**valid, 'rating': rating} for rating in (0, 6, 2.5, '5', True, None)),
            *({**valid, 'comment': comment} for comment in ('', ' \n ', 'а' * 2001, None)),
            {'comment': 'Хорошая работа'}, {'rating': 5},
            {**valid, 'created_at': '2020-01-01T00:00:00Z'}, {**valid, 'points': 100},
        ]
        for body in invalid:
            with self.subTest(body=body):
                response = self.client.post(f"/api/proposals/{proposal['id']}/review", json=body)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()['error']['code'], 'VALIDATION_ERROR')
        with self.app.state.database.session() as repo:
            self.assertIsNone(repo.get('proposals', proposal['id'])['review'])
        response = self.client.post(f"/api/proposals/{proposal['id']}/review", json={'rating': 3, 'comment': 'а' * 2000})
        self.assertEqual(response.status_code, 200)

    def test_identical_retry_is_idempotent_and_changed_review_is_rejected(self):
        proposal = self.completed_proposal()
        url = f"/api/proposals/{proposal['id']}/review"
        body = {'rating': 4, 'comment': 'Полезный результат'}
        saved = self.client.post(url, json=body).json()
        repeat = self.client.post(url, json={**body, 'comment': ' Полезный результат '})
        self.assertEqual(repeat.status_code, 200)
        self.assertEqual(repeat.json(), saved)
        for changed in ({**body, 'rating': 5}, {**body, 'comment': 'Другой отзыв'}):
            response = self.client.post(url, json=changed, headers={'Accept-Language': 'kk'})
            self.assertEqual(response.status_code, 409)
            self.assertIn('сақталған', response.json()['error']['message'])
        with self.app.state.database.session() as repo:
            self.assertEqual(repo.get('proposals', proposal['id']), saved)

    def test_review_survives_application_restart_and_legacy_records_remain_readable(self):
        proposal = self.completed_proposal()
        # Existing databases have proposal JSON without the new optional field.
        with self.app.state.database.session(write=True) as repo:
            legacy = repo.get('proposals', proposal['id'])
            legacy.pop('review')
            repo.update('proposals', legacy)
        listed = next(item for item in self.client.get('/api/proposals').json()['items'] if item['id'] == proposal['id'])
        self.assertIsNone(listed['review'])
        response = self.client.post(f"/api/proposals/{proposal['id']}/review", json={'rating': 5, 'comment': 'Жақсы нәтиже'})
        self.assertEqual(response.status_code, 200)
        saved = response.json()
        with TestClient(create_app(self.settings)) as restarted:
            restored = next(item for item in restarted.get('/api/proposals').json()['items'] if item['id'] == proposal['id'])
            self.assertEqual(restored, saved)
        self.openai.assert_not_called()

    def test_concurrent_reviews_cannot_overwrite_each_other(self):
        proposal = self.completed_proposal()
        url = f"/api/proposals/{proposal['id']}/review"
        bodies = [{'rating': 4, 'comment': 'Первый отзыв'}, {'rating': 5, 'comment': 'Второй отзыв'}]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda body: self.client.post(url, json=body), bodies))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
        winner = next(response.json() for response in responses if response.status_code == 200)
        with self.app.state.database.session() as repo:
            self.assertEqual(repo.get('proposals', proposal['id']), winner)

    def test_unknown_proposal_returns_not_found(self):
        response = self.client.post('/api/proposals/missing/review', json={'rating': 5, 'comment': 'Хорошая работа'})
        self.assertEqual(response.status_code, 404)

    def test_review_cannot_be_injected_when_submitting_proposal(self):
        response = self.client.post('/api/tasks/task_reviews/proposals', json={
            'team_id': 'team_1', 'idea': 'Полезная идея', 'plan': 'Подробный план', 'deadline': 'Неделя',
            'review': {'rating': 5, 'comment': 'Сами себе поставим оценку'},
        })
        self.assertEqual(response.status_code, 422)
