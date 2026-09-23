"""Deterministic completeness rules. No model or browser awards points."""
import re
from dataclasses import dataclass

from .localization import Locale
from .schemas import Card, CardField, Level, Rating


@dataclass(frozen=True)
class Rule:
    key: str
    fields: tuple[tuple[CardField, int], ...]
    messages: tuple[str, str]


RULES = (
    Rule('context', (('context', 10), ('need', 10)), (
        'Опишите текущую ситуацию и то, что нужно изменить.', 'Қазіргі жағдайды және нені өзгерту керектігін сипаттаңыз.')),
    Rule('data', (('data', 20),), (
        'Укажите доступные данные, их формат или источник.', 'Қолжетімді деректерді, олардың пішімін немесе көзін көрсетіңіз.')),
    Rule('expected_result', (('expected_result', 15),), (
        'Опишите конкретный результат работы команды.', 'Команда жұмысының нақты нәтижесін сипаттаңыз.')),
    Rule('success_criteria', (('success_criteria', 15),), (
        'Добавьте измеримый критерий приёмки.', 'Қабылдаудың өлшенетін өлшемін қосыңыз.')),
    Rule('constraints', (('constraints', 10),), (
        'Укажите срок или технические ограничения.', 'Мерзімді немесе техникалық шектеулерді көрсетіңіз.')),
    Rule('users', (('users', 10),), (
        'Укажите, кто будет пользоваться решением.', 'Шешімді кім қолданатынын көрсетіңіз.')),
    Rule('communication', (('contact', 5), ('interaction_format', 5)), (
        'Добавьте контакт и порядок обратной связи.', 'Байланыс деректерін және кері байланыс тәртібін қосыңыз.')),
)
PLACEHOLDERS = frozenset({
    'не знаю', 'нет', 'пока нет', 'не указано', 'неизвестно', 'уточняется',
    'n/a', 'unknown', '-', '—', 'тест', 'test', 'білмеймін', 'белгісіз',
    'жоқ', 'әзірге жоқ', 'көрсетілмеген', 'нақтыланады',
    'пока неизвестно', 'не определено', 'нет данных', 'деректер жоқ', 'әзірге белгісіз', 'анықталмаған',
})


def filled(value: str | None) -> bool:
    text = re.sub(r'\s+', ' ', value or '').strip()
    normalized = text.casefold().rstrip(' .!?…')
    return len(text) >= 3 and any(c.isalnum() for c in text) and normalized not in PLACEHOLDERS


def level_for_score(score: int) -> Level:
    if not 0 <= score <= 100:
        raise ValueError('Score must be between 0 and 100')
    return 'priority' if score >= 90 else 'ready' if score >= 70 else 'working' if score >= 40 else 'draft'


def evaluate(card: Card, locale: Locale = 'ru') -> dict:
    breakdown, improvements = [], []
    for rule in RULES:
        earned = sum(points for field, points in rule.fields if filled(getattr(card, field)))
        breakdown.append({'key': rule.key, 'earned': earned, 'max': sum(points for _, points in rule.fields)})
        missing = [field for field, _ in rule.fields if not filled(getattr(card, field))]
        if missing:
            improvements.append({'fields': missing, 'message': rule.messages[locale == 'kk']})
    score = sum(item['earned'] for item in breakdown)
    return Rating(score=score, level=level_for_score(score), breakdown=breakdown, improvements=improvements).model_dump()
