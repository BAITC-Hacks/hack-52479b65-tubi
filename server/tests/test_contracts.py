import json
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ai import fallback
from app.errors import register_error_handlers
from app.main import create_app
from app.schemas import PrepareInput, PrepareResponse, Proposal, Task, Team
from app.seed import seed_records
from helpers import ApiTestCase

ROOT = Path(__file__).resolve().parents[2]


class ContractTest(unittest.TestCase):
    def test_exported_openapi_matches_application(self):
        exported = json.loads((ROOT / 'contracts/openapi.json').read_text(encoding='utf-8'))
        self.assertEqual(exported, create_app().openapi())
        for path, operations in exported['paths'].items():
            for method, operation in operations.items():
                with self.subTest(path=path, method=method):
                    self.assertTrue(any(p['name'] == 'accept-language' for p in operation['parameters']))
                    self.assertIn('422', operation['responses'])
                    success = operation['responses'].get('201', operation['responses'].get('200'))
                    self.assertIn('$ref', success['content']['application/json']['schema'])
        self.assertNotIn('GroundedResult', exported['components']['schemas'])
        self.assertNotIn('Evidence', exported['components']['schemas'])

    def test_fixtures_are_valid_and_reproducible(self):
        fixtures = json.loads((ROOT / 'contracts/fixtures.json').read_text(encoding='utf-8'))
        request = PrepareInput.model_validate(fixtures['prepare_request'])
        self.assertEqual(fixtures['prepare_response'], fallback(request))
        self.assertEqual(fixtures['prepare_response_kk'], fallback(request, locale='kk'))
        for name in ('prepare_response', 'prepare_response_kk', 'compose_response'):
            PrepareResponse.model_validate(fixtures[name])
        compose = PrepareInput.model_validate(fixtures['compose_request'])
        self.assertEqual(fixtures['compose_response'], fallback(compose))
        records = seed_records()
        for table, model in (('tasks', Task), ('teams', Team), ('proposals', Proposal)):
            self.assertEqual(fixtures[f'{table}_response']['items'], records[table])
            for item in records[table]:
                model.model_validate(item)


class ErrorContractTest(ApiTestCase):
    def test_method_not_allowed_preserves_allow_header(self):
        application = FastAPI()
        register_error_handlers(application)

        @application.get('/example')
        def example():
            return {'ok': True}

        with TestClient(application) as client:
            response = client.delete('/example')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.headers['allow'], 'GET')
        self.assertEqual(response.json()['error']['code'], 'HTTP_405')

    def test_extended_sqlite_lock_codes_are_retryable(self):
        for code in (sqlite3.SQLITE_BUSY_SNAPSHOT, sqlite3.SQLITE_LOCKED_SHAREDCACHE):
            with self.subTest(code=code):
                error = sqlite3.OperationalError('private database detail')
                error.sqlite_errorcode = code
                with patch.object(self.app.state.database, 'session', side_effect=error):
                    response = self.client.get('/api/tasks')
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.headers['retry-after'], '1')
                self.assertNotIn('private', response.text)

    def test_database_busy_is_localized_and_does_not_expose_details(self):
        error = sqlite3.OperationalError('sensitive SQL and user content')
        error.sqlite_errorcode = sqlite3.SQLITE_BUSY
        with patch.object(self.app.state.database, 'session', side_effect=error):
            response = self.client.get('/api/tasks', headers={'Accept-Language': 'kk'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error']['code'], 'HTTP_503')
        self.assertIn('Дерекқор', response.json()['error']['message'])
        self.assertNotIn('sensitive', response.text)

    def test_other_database_errors_use_safe_envelope(self):
        error = sqlite3.OperationalError('sensitive SQL and user content')
        with patch.object(self.app.state.database, 'session', side_effect=error):
            with self.assertLogs('app.errors', level='ERROR') as logs:
                response = self.client.get('/api/tasks')
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['error']['code'], 'HTTP_500')
        self.assertNotIn('sensitive', response.text + str(logs.output))

    def test_unknown_api_path_uses_same_error_shape(self):
        response = self.client.get('/api/not-a-route', headers={'Accept-Language': 'kk'})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error']['message'], 'Жазба табылмады.')
