from dataclasses import replace
from types import SimpleNamespace
import httpx
from openai import APITimeoutError

from app.ai_grounding import GroundedResult
from app.ai_questions import question_key
from app.schemas import Card
from helpers import ApiTestCase


class AITest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.request = {
            'stage': 'clarify', 'category': 'analytics',
            'description': 'Мы читаем отзывы вручную. Доступны 100 отзывов в CSV.',
            'answers': [],
        }

    def model_result(self):
        return {
            'card': Card(
                title='Мы читаем отзывы вручную.', context='Мы читаем отзывы вручную.',
                data='Доступны 100 отзывов в CSV.',
            ).model_dump(),
            'questions': [
                {'id': 'q_need', 'fields': ['need'], 'text': 'Что нужно улучшить?'},
                {'id': 'q_result', 'fields': ['expected_result'], 'text': 'Что должно получиться?'},
                {'id': 'q_success', 'fields': ['success_criteria'], 'text': 'Как оценить успех?'},
            ],
            'evidence': [
                {'field': 'title', 'quote': 'Мы читаем отзывы вручную.', 'source': 'description', 'answer_index': None},
                {'field': 'context', 'quote': 'Мы читаем отзывы вручную.', 'source': 'description', 'answer_index': None},
                {'field': 'data', 'quote': 'Доступны 100 отзывов в CSV.', 'source': 'description', 'answer_index': None},
            ],
        }

    def live(self, result=None, *, status='completed', output=None):
        self.app.state.settings = replace(self.settings, openai_api_key='unit-test-key')
        parser = self.openai.return_value.__enter__.return_value.responses.parse
        parser.return_value = SimpleNamespace(
            status=status,
            output_parsed=self.model_result() if result is None else result,
            output=output or [],
        )
        return parser

    def prepare(self, locale=None):
        headers = {'Accept-Language': locale} if locale else {}
        response = self.client.post('/api/ai/prepare', json=self.request, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def assert_questions(self, result):
        questions = result['questions']
        self.assertGreaterEqual(len(questions), 3)
        self.assertEqual(len({q['id'] for q in questions}), len(questions))
        self.assertEqual(len({question_key(q['text']) for q in questions}), len(questions))
        self.assertTrue(all(q['fields'] and q['text'].strip() for q in questions))

    def test_fallback_without_key_is_explicit(self):
        result = self.prepare()
        self.assertEqual(result['mode'], 'fallback')
        self.assertIn('Деморежим', result['warnings'][0])
        self.openai.assert_not_called()
        self.assert_questions(result)
        self.assertIsNone(result['card']['contact'])
        self.assertIsNone(result['card']['constraints'])
        self.assertEqual(result['card']['data'], 'Доступны 100 отзывов в CSV.')
        self.assertNotIn('data', [f for q in result['questions'] for f in q['fields']])

    def test_structured_json_live_and_private_evidence(self):
        import json
        parsed = GroundedResult.model_validate_json(json.dumps(self.model_result()))
        parser = self.live(parsed)
        result = self.prepare()
        self.assertEqual(result['mode'], 'live')
        self.assertEqual(result['card']['data'], 'Доступны 100 отзывов в CSV.')
        self.assertEqual(set(result), {'mode', 'card', 'questions', 'missing_fields', 'warnings'})
        self.assertNotIn('evidence', result)
        self.assert_questions(result)
        self.openai.assert_called_once_with(api_key='unit-test-key', timeout=20.0, max_retries=0)
        self.assertIs(parser.call_args.kwargs['text_format'], GroundedResult)
        self.assertFalse(parser.call_args.kwargs['store'])

    def test_missing_quote_removes_fact(self):
        result = self.model_result()
        result['card']['constraints'] = 'Срок 14 дней'
        result['evidence'].append({'field': 'constraints', 'quote': 'Срок 14 дней', 'source': 'description', 'answer_index': None})
        self.live(result)
        prepared = self.prepare()
        self.assertEqual(prepared['mode'], 'live')
        self.assertIsNone(prepared['card']['constraints'])
        self.assertIn('constraints', prepared['missing_fields'])
        self.assertIn('не подтверждена', prepared['warnings'][0])

    def test_real_quote_does_not_justify_unrelated_value(self):
        result = self.model_result()
        result['card']['data'] = 'Доступны 500 отзывов в CSV.'
        self.live(result)
        prepared = self.prepare()
        self.assertIsNone(prepared['card']['data'])
        self.assertIn('data', prepared['missing_fields'])

    def test_value_must_equal_quote_not_just_a_substring(self):
        result = self.model_result()
        result['card']['data'] = '100'
        self.live(result)
        self.assertIsNone(self.prepare()['card']['data'])

    def test_question_text_is_not_a_source(self):
        self.request.update(stage='compose', answers=[{
            'question_id': 'q_data', 'fields': ['data'],
            'question': 'У вас есть 5000 строк?', 'answer': 'Пока неизвестно',
        }])
        result = self.model_result()
        result['card']['data'] = '5000 строк'
        result['evidence'] = [{'field': 'data', 'quote': '5000 строк', 'source': 'answer', 'answer_index': 0}]
        self.live(result)
        self.assertIsNone(self.prepare()['card']['data'])

    def test_answer_evidence_and_compose(self):
        self.request.update(stage='compose', answers=[{
            'question_id': 'q_need', 'fields': ['need'],
            'question': 'Что улучшить?', 'answer': 'Сократить время обработки',
        }])
        result = self.model_result()
        result['card']['need'] = 'Сократить время обработки'
        result['evidence'].append({'field': 'need', 'quote': 'Сократить время обработки', 'source': 'answer', 'answer_index': 0})
        self.live(result)
        prepared = self.prepare()
        self.assertEqual(prepared['card']['need'], self.request['answers'][0]['answer'])
        self.assertEqual(prepared['questions'], [])
        for bad_index in (-1, 7, None):
            with self.subTest(index=bad_index):
                result['evidence'][-1]['answer_index'] = bad_index
                self.live(result)
                self.assertIsNone(self.prepare()['card']['need'])

    def test_refusal_falls_back(self):
        output = [SimpleNamespace(type='message', content=[SimpleNamespace(type='refusal')])]
        self.live(output=output)
        self.assertEqual(self.prepare()['mode'], 'fallback')

    def test_absent_and_incomplete_output_fall_back(self):
        parser = self.live()
        for status, parsed in (('completed', None), ('incomplete', self.model_result())):
            parser.return_value = SimpleNamespace(status=status, output_parsed=parsed, output=[])
            with self.subTest(status=status):
                result = self.prepare('kk')
                self.assertEqual(result['mode'], 'fallback')
                self.assertIn('уақытша', result['warnings'][0])
                self.assert_questions(result)

    def test_timeout_and_provider_error_preserve_answers_without_logging_content(self):
        parser = self.live()
        self.request.update(stage='compose', answers=[{
            'question_id': 'q_need', 'fields': ['need'], 'question': 'Что улучшить?', 'answer': 'Ускорить работу',
        }])
        exceptions = (APITimeoutError(request=httpx.Request('POST', 'https://api.openai.com/v1/responses')),
                      RuntimeError('private-description unit-test-key'))
        for exc in exceptions:
            parser.side_effect = exc
            with self.subTest(error=type(exc).__name__), self.assertLogs('app.ai', level='WARNING') as logs:
                result = self.prepare()
            self.assertEqual(result['mode'], 'fallback')
            self.assertEqual(result['card']['need'], 'Ускорить работу')
            self.assertNotIn('private-description', str(logs.output))
            self.assertNotIn('unit-test-key', str(logs.output))

    def test_malformed_model_output_falls_back(self):
        for result in ({}, {'card': {'category': 'invented'}}, 'not JSON'):
            with self.subTest(result=result):
                self.live(result)
                self.assertEqual(self.prepare()['mode'], 'fallback')

    def test_invalid_questions_fall_back(self):
        for kind in ('too_few', 'same_id', 'same_text', 'no_fields', 'long_id', 'long_text', 'many_fields', 'empty'):
            result = self.model_result()
            if kind == 'too_few':
                result['questions'] = result['questions'][:2]
            elif kind == 'same_id':
                result['questions'][1]['id'] = result['questions'][0]['id']
            elif kind == 'same_text':
                result['questions'][1]['text'] = ' ЧТО нужно улучшить?! '
            elif kind == 'no_fields':
                result['questions'][0]['fields'] = []
            elif kind == 'long_id':
                result['questions'][0]['id'] = 'q' * 81
            elif kind == 'long_text':
                result['questions'][0]['text'] = 'Что улучшить? ' * 500
            elif kind == 'many_fields':
                result['questions'][0]['fields'] = ['need'] * 11
            else:
                result['questions'][0]['text'] = '  '
            with self.subTest(kind=kind):
                self.live(result)
                prepared = self.prepare()
                self.assertEqual(prepared['mode'], 'fallback')
                self.assert_questions(prepared)

    def test_model_questions_about_known_facts_are_replaced(self):
        result = self.model_result()
        result['questions'][0] = {'id': 'q_data', 'fields': ['data'], 'text': 'Какие данные уже есть?'}
        self.live(result)
        prepared = self.prepare()
        self.assertEqual(prepared['mode'], 'live')
        self.assert_questions(prepared)
        self.assertNotIn('q_data', [q['id'] for q in prepared['questions']])
        self.assertIn('шаблонами', prepared['warnings'][-1])

    def test_known_description_facts_are_retained_if_model_omits_them(self):
        result = self.model_result()
        result['card']['data'] = None
        result['evidence'] = []
        self.live(result)
        self.assertEqual(self.prepare()['card']['data'], 'Доступны 100 отзывов в CSV.')

    def test_answered_questions_are_not_repeated(self):
        self.request['answers'] = [{
            'question_id': 'q_need', 'fields': ['need'], 'question': 'Что именно вы хотите изменить или улучшить?',
            'answer': 'Группировать отзывы по темам',
        }]
        prepared = self.prepare()
        self.assert_questions(prepared)
        self.assertNotIn('need', [f for q in prepared['questions'] for f in q['fields']])

    def test_rich_description_still_gets_three_distinct_detail_questions(self):
        self.request['description'] = '\n'.join([
            'Название: Анализ отзывов', 'Контекст: Читаем вручную', 'Цель: Сократить время обработки',
            'Данные: Обезличенные отзывы в CSV', 'Результат: Панель с темами отзывов',
            'Критерии: Проверим точность на ста отзывах', 'Ограничения: Две недели',
            'Пользователи: Менеджеры', 'Контакт: biz@example.kz', 'Обратная связь: Еженедельный созвон',
        ])
        result = self.prepare()
        self.assertEqual(result['missing_fields'], [])
        self.assert_questions(result)
        self.assertTrue(all(q['id'].startswith('detail_') for q in result['questions']))

    def test_fallback_locales_and_default_do_not_translate_user_text(self):
        default, ru, kk = self.prepare(), self.prepare('ru'), self.prepare('kk')
        self.assertEqual(default, ru)
        self.assertEqual(default, self.prepare('en'))
        self.assertEqual(kk, self.prepare('kk-KZ,ru;q=0.8'))
        self.assertEqual(ru, self.prepare('kk;q=0.1,ru;q=0.9'))
        self.assertEqual(ru['card'], kk['card'])
        self.assertNotEqual(ru['warnings'], kk['warnings'])
        self.assertNotEqual(ru['questions'][0]['text'], kk['questions'][0]['text'])

    def test_live_questions_use_requested_language_instruction(self):
        result = self.model_result()
        for question, text in zip(result['questions'], ('Нені жақсарту керек?', 'Нәтиже қандай болуы керек?', 'Табысты қалай өлшейсіз?')):
            question['text'] = text
        parser = self.live(result)
        prepared = self.prepare('kk')
        self.assertIn('казахском', parser.call_args.kwargs['input'][0]['content'])
        self.assertEqual(prepared['questions'][0]['text'], 'Нені жақсарту керек?')
        self.assertEqual(prepared['card']['data'], 'Доступны 100 отзывов в CSV.')

    def test_blank_answers_do_not_erase_explicit_source_data(self):
        self.request.update(stage='compose', answers=[{
            'question_id': 'q_data', 'fields': ['data'], 'question': 'Какие данные?', 'answer': '   ',
        }])
        self.assertEqual(self.prepare()['card']['data'], 'Доступны 100 отзывов в CSV.')

    def test_unknown_optional_detail_preserves_known_fact(self):
        self.request['stage'] = 'compose'
        for answer in ('Не знаю', 'Нет', 'Белгісіз', 'Не знаю .'):
            self.request['answers'] = [{
                'question_id': 'detail_data_access', 'fields': ['data'],
                'question': 'Как команда получит доступ к материалам?', 'answer': answer,
            }]
            with self.subTest(answer=answer):
                self.assertEqual(self.prepare()['card']['data'], 'Доступны 100 отзывов в CSV.')

    def test_explicit_unknown_answer_can_clear_source_fact(self):
        self.request.update(stage='compose', answers=[{
            'question_id': 'q_data', 'fields': ['data'],
            'question': 'Какие данные доступны?', 'answer': 'Не знаю',
        }])
        self.assertIsNone(self.prepare()['card']['data'])

    def test_empty_label_does_not_consume_the_next_field(self):
        for locale, description, expected_result in (
            ('ru', 'Данные:\nРезультат: Панель с темами отзывов', 'Панель с темами отзывов'),
            ('kk', 'Деректер:\r\nНәтиже: Пікірлер тақырыптарының панелі', 'Пікірлер тақырыптарының панелі'),
        ):
            self.request['description'] = description
            with self.subTest(locale=locale):
                prepared = self.prepare(locale)
                self.assertIsNone(prepared['card']['data'])
                self.assertIn('data', prepared['missing_fields'])
                self.assertEqual(prepared['card']['expected_result'], expected_result)

    def test_live_recovery_keeps_explicitly_empty_label_unknown(self):
        self.request['description'] = 'Данные:\nРезультат: Панель с темами отзывов'
        result = self.model_result()
        result['card'] = Card().model_dump()
        result['evidence'] = []
        self.live(result)
        prepared = self.prepare()
        self.assertEqual(prepared['mode'], 'live')
        self.assertIsNone(prepared['card']['data'])
        self.assertEqual(prepared['card']['expected_result'], 'Панель с темами отзывов')

    def test_clear_need_is_not_asked_again(self):
        self.request['description'] = 'Хотим сократить время обработки отзывов. Данные в CSV.'
        prepared = self.prepare()
        self.assertEqual(prepared['card']['need'], 'Хотим сократить время обработки отзывов.')
        self.assertNotIn('need', [f for q in prepared['questions'] for f in q['fields']])
        self.assertNotIn('data', [f for q in prepared['questions'] for f in q['fields']])

    def test_kazakh_labels_are_copied_without_translation(self):
        self.request['description'] = 'Мақсат: Пікірлерді тақырыптарға бөлу\nДеректер: Жүз пікірден тұратын CSV\nПайдаланушылар: Кофехана менеджерлері'
        result = self.prepare('kk')
        self.assertEqual(result['card']['need'], 'Пікірлерді тақырыптарға бөлу')
        self.assertEqual(result['card']['data'], 'Жүз пікірден тұратын CSV')
        self.assertEqual(result['card']['users'], 'Кофехана менеджерлері')
        self.assertTrue(all(not set(q['fields']) & {'need', 'data', 'users'} for q in result['questions']))

    def test_real_sdk_parses_mock_http_without_network(self):
        import json
        from openai import OpenAI

        calls = []

        def handler(request):
            body = json.loads(request.content)
            calls.append(body)
            schema = body['text']['format']['schema']
            self.assertNotIn('default', schema['$defs']['ExtractedCard']['properties']['category'])
            self.assertTrue(body['text']['format']['strict'])
            self.assertFalse(body['store'])
            return httpx.Response(200, json={
                'id': 'resp_mock', 'object': 'response', 'created_at': 0,
                'status': 'completed', 'model': 'gpt-4o-mini',
                'output': [{
                    'id': 'msg_mock', 'type': 'message', 'role': 'assistant', 'status': 'completed',
                    'content': [{'type': 'output_text', 'text': json.dumps(self.model_result()), 'annotations': []}],
                }],
                'parallel_tool_calls': False, 'tool_choice': 'auto', 'tools': [],
            })

        self.app.state.settings = replace(self.settings, openai_api_key='unit-test-key')
        self.openai.return_value = OpenAI(
            api_key='unit-test-key', max_retries=0,
            http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        )
        result = self.prepare()
        self.assertEqual(result['mode'], 'live')
        self.assertEqual(len(calls), 1)
        self.assertEqual(result['card']['data'], 'Доступны 100 отзывов в CSV.')

    def test_three_questions_remain_after_twenty_previous_answers(self):
        self.request['description'] = '\n'.join(
            f'{field}: Указанные сведения' for field in Card.model_fields if field != 'category'
        )
        for _ in range(7):
            result = self.prepare()
            self.assert_questions(result)
            previous = {question_key(answer['question']) for answer in self.request['answers']}
            self.assertFalse(previous & {question_key(q['text']) for q in result['questions']})
            self.request['answers'].extend({
                'question_id': question['id'], 'fields': question['fields'],
                'question': question['text'], 'answer': 'Дополнительные сведения',
            } for question in result['questions'])
            self.request['answers'] = self.request['answers'][:20]
        self.assert_questions(self.prepare())
