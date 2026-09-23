from .schemas import Card

# One source of truth. The browser never awards points.
RULES = [
    ('context', 20, [('context', 10), ('need', 10)], 'Опишите текущую ситуацию и то, что нужно изменить.'),
    ('data', 20, [('data', 20)], 'Укажите доступные данные, их формат или источник.'),
    ('expected_result', 15, [('expected_result', 15)], 'Опишите конкретный результат работы команды.'),
    ('success_criteria', 15, [('success_criteria', 15)], 'Добавьте измеримый критерий приёмки.'),
    ('constraints', 10, [('constraints', 10)], 'Укажите срок или технические ограничения.'),
    ('users', 10, [('users', 10)], 'Укажите, кто будет пользоваться решением.'),
    ('communication', 10, [('contact', 5), ('interaction_format', 5)], 'Добавьте контакт и порядок обратной связи.'),
]
PLACEHOLDERS = {'не знаю', 'нет', 'пока нет', 'не указано', 'неизвестно', 'уточняется', 'n/a', 'unknown', '-', '—', 'тест', 'test'}


def filled(value: str | None) -> bool:
    text = (value or '').strip()
    return len(text) >= 3 and any(c.isalnum() for c in text) and text.casefold().rstrip('.') not in PLACEHOLDERS


def evaluate(card: Card) -> dict:
    values = card.model_dump()
    breakdown, improvements = [], []
    for key, weight, fields, message in RULES:
        earned = sum(points for field, points in fields if filled(values[field]))
        breakdown.append({'key': key, 'earned': earned, 'max': weight})
        missing = [field for field, _ in fields if not filled(values[field])]
        if missing:
            improvements.append({'fields': missing, 'message': message})
    score = sum(item['earned'] for item in breakdown)
    level = 'priority' if score >= 90 else 'ready' if score >= 70 else 'working' if score >= 40 else 'draft'
    return {'score': score, 'level': level, 'breakdown': breakdown, 'improvements': improvements}
