"""Isolated application instances and a mandatory OpenAI mock for all API tests."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='tubi-test-')
        self.addCleanup(temp.cleanup)
        self.settings = Settings(db_path=Path(temp.name) / 'test.sqlite3')
        mock = patch('app.ai.OpenAI')
        self.openai = mock.start()
        self.addCleanup(mock.stop)
        self.app = create_app(self.settings)
        self.client = self.enterContext(TestClient(self.app))

    def new_task(self, **fields):
        response = self.client.post('/api/tasks', json={'card': {'title': 'Задача для проверки', **fields}, 'confirmed': True})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def new_proposal(self, task_id, team_id='team_1'):
        response = self.client.post(f'/api/tasks/{task_id}/proposals', json={
            'team_id': team_id, 'idea': 'Разработаем прототип', 'plan': 'Изучим данные и покажем результат',
            'deadline': 'Две недели', 'prototype_url': None,
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()
