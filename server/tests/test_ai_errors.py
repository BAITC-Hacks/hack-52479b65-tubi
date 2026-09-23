from dataclasses import replace

import httpx
from openai import APIConnectionError, APITimeoutError, AuthenticationError, RateLimitError

from helpers import ApiTestCase


class AIErrorTest(ApiTestCase):
    def test_provider_failures_are_localized_safe_and_keep_user_answers(self):
        self.app.state.settings = replace(self.settings, openai_api_key='secret-test-key')
        parser = self.openai.return_value.__enter__.return_value.responses.parse
        request = httpx.Request('POST', 'https://api.openai.com/v1/responses')
        private_message = 'secret-test-key private-provider-body'
        failures = (
            (AuthenticationError(private_message, response=httpx.Response(401, request=request), body=None), 'ключ', 'кілт'),
            (RateLimitError(private_message, response=httpx.Response(429, request=request), body=None), 'лимит', 'шегіне'),
            (APITimeoutError(request=request), 'вовремя', 'уақытында'),
            (APIConnectionError(message=private_message, request=request), 'соединиться', 'байланыс'),
        )
        body = {
            'stage': 'compose', 'category': 'analytics',
            'description': 'Отзывы приходится разбирать вручную.',
            'answers': [{'question_id': 'q_need', 'fields': ['need'],
                         'question': 'Что улучшить?', 'answer': 'Сократить время обработки'}],
        }
        before = self.client.get('/api/tasks?include_drafts=true').json()
        for error, ru_fragment, kk_fragment in failures:
            for locale, fragment in (('ru', ru_fragment), ('kk', kk_fragment)):
                with self.subTest(error=type(error).__name__, locale=locale):
                    parser.side_effect = error
                    with self.assertLogs('app.ai', level='WARNING') as logs:
                        response = self.client.post('/api/ai/prepare', json=body, headers={'Accept-Language': locale})
                    self.assertEqual(response.status_code, 200)
                    result = response.json()
                    self.assertEqual(result['mode'], 'fallback')
                    self.assertEqual(result['card']['need'], 'Сократить время обработки')
                    self.assertEqual(result['questions'], [])
                    self.assertIn(fragment, result['warnings'][0])
                    for secret in ('secret-test-key', 'private-provider-body'):
                        self.assertNotIn(secret, response.text + str(logs.output))
        self.assertEqual(before, self.client.get('/api/tasks?include_drafts=true').json())
