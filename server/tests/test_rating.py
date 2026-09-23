import unittest

from app.rating import PLACEHOLDERS, RULES, evaluate, filled, level_for_score
from app.schemas import Card


class RatingTest(unittest.TestCase):
    def test_level_boundaries(self):
        for score, expected in ((0, 'draft'), (39, 'draft'), (40, 'working'), (69, 'working'),
                                (70, 'ready'), (89, 'ready'), (90, 'priority'), (100, 'priority')):
            with self.subTest(score=score):
                self.assertEqual(level_for_score(score), expected)

    def test_score_range(self):
        for score in (-1, 101):
            with self.assertRaises(ValueError):
                level_for_score(score)

    def test_weights_and_field_contributions(self):
        self.assertEqual([sum(points for _, points in rule.fields) for rule in RULES], [20, 20, 15, 15, 10, 10, 10])
        for rule in RULES:
            for field, points in rule.fields:
                with self.subTest(field=field):
                    rating = evaluate(Card(**{field: 'Указаны сведения'}))
                    self.assertEqual(rating['score'], points)
        card = Card(**{field: 'Указаны сведения' for field in Card.model_fields if field != 'category'})
        self.assertEqual(evaluate(card)['score'], 100)
        self.assertEqual(evaluate(card)['improvements'], [])

    def test_blank_and_placeholders(self):
        for value in (None, '', '  ', '\n\t', '?!?', 'ab', *PLACEHOLDERS, ' НЕ   ЗНАЮ! ', 'БЕЛГІСІЗ.'):
            with self.subTest(value=value):
                self.assertFalse(filled(value))
                self.assertEqual(evaluate(Card(data=value))['score'], 0)
        self.assertTrue(filled('100 обезличенных строк CSV'))
        self.assertIsNone(Card(data=' \t ').data)

    def test_removing_fields_decreases_score(self):
        card = Card(context='Магазин в Алматы', need='Анализ отзывов', data='CSV с отзывами')
        self.assertEqual(evaluate(card)['score'], 40)
        card.data = None
        self.assertEqual(evaluate(card)['score'], 20)

    def test_localization_does_not_change_score(self):
        card = Card(data='Пікірлер CSV файлында')
        ru, kk = evaluate(card), evaluate(card, 'kk')
        self.assertEqual(ru['score'], kk['score'])
        self.assertEqual(ru['breakdown'], kk['breakdown'])
        self.assertNotEqual(ru['improvements'], kk['improvements'])
