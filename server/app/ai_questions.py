"""Conservative local extraction and question selection, also usable without OpenAI."""
import re

from .localization import Locale, field_label
from .rating import filled
from .schemas import Card, PrepareInput, Question

QUESTIONS = {
    'need': ('Что именно вы хотите изменить или улучшить?', 'Нені өзгерткіңіз немесе жақсартқыңыз келеді?'),
    'data': ('Какие данные или материалы уже есть? Укажите формат и источник.', 'Қандай деректер немесе материалдар бар? Пішімі мен көзін көрсетіңіз.'),
    'expected_result': ('Что команда должна передать вам в конце работы?', 'Жұмыс соңында команда сізге нені тапсыруы керек?'),
    'success_criteria': ('Как вы измерите, что задача решена успешно?', 'Тапсырманың сәтті орындалғанын қалай өлшейсіз?'),
    'constraints': ('Какие сроки, технологии или ограничения нужно учесть?', 'Қандай мерзімдерді, технологияларды немесе шектеулерді ескеру керек?'),
    'users': ('Кто будет пользоваться решением?', 'Шешімді кім қолданады?'),
    'contact': ('К кому команда может обратиться с вопросами?', 'Сұрақтар бойынша команда кімге жүгіне алады?'),
    'interaction_format': ('Как часто и в каком формате вы готовы давать обратную связь?', 'Қаншалықты жиі және қандай пішімде кері байланыс бере аласыз?'),
    'context': ('Как эта работа устроена сейчас?', 'Бұл жұмыс қазір қалай ұйымдастырылған?'),
    'title': ('Какое короткое название подходит задаче?', 'Тапсырмаға қандай қысқа атау сәйкес келеді?'),
}
ALIASES = {
    'title': ('название', 'атауы', 'атау'),
    'context': ('контекст', 'текущая ситуация', 'мәнмәтін', 'қазіргі жағдай'),
    'need': ('потребность', 'цель', 'қажеттілік', 'мақсат'),
    'data': ('данные', 'деректер'),
    'expected_result': ('результат', 'нәтиже'),
    'success_criteria': ('критерии', 'критерии успеха', 'критерий успеха', 'табыс өлшемдері', 'қабылдау өлшемі'),
    'constraints': ('ограничения', 'срок', 'шектеулер', 'мерзім'),
    'users': ('пользователи', 'пайдаланушылар'),
    'contact': ('контакт', 'байланыс'),
    'interaction_format': ('обратная связь', 'кері байланыс'),
}
# These patterns copy whole source sentences, never synthesize a fact.
CUES = {
    'need': r'\b(?:хотим|нужно|необходимо)\s+(?:ускорить|сократить|сгруппировать|автоматизировать|улучшить|находить)\b|мақсатымыз',
    'data': r'\b(?:csv|xlsx?|excel|json)\b|(?:есть|имеем|доступн\w*)\s+(?:данные|выгрузк\w*)|деректер\s+бар',
    'users': r'(?:пользовател\w*\s*(?:—|:|-)|пользоваться\s+(?:будут|будет))|пайдаланушылары',
    'expected_result': r'(?:результат\w*\s*(?:—|:|-)|на выходе|нужно получить|команда (?:должна )?переда\w*)|нәтижесінде',
    'success_criteria': r'(?:критери\w* (?:успеха|приёмки)|успех(?:ом)? считаем|проверим (?:точность|результат))|қабылдау өлшемі',
    'constraints': r'(?:срок|дедлайн|бюджет)\s*(?:—|:|-)|(?:за|в течение)\s+\d+\s+(?:дней|недел\w*)|мерзімі',
    'contact': r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}',
    'interaction_format': r'(?:обратн\w*\s+связ\w*|кері байланыс)\s*(?:—|:|-)|(?:созвон|встреча)\s+(?:кажд\w*|раз в)|(?:еженедельн\w*|ежедневн\w*)\s+созвон',
}
# When fewer than three fields are missing, ask about additional decisions.
# These are never stored as invented facts; only the user's answer may extend a field.
DETAIL_QUESTIONS = (
    ('data_access', 'data', (
        'Как команда получит доступ к материалам? Если порядок ещё не определён, укажите это.',
        'Команда материалдарға қалай қол жеткізеді? Тәртібі әлі анықталмаса, соны көрсетіңіз.')),
    ('acceptance_example', 'success_criteria', (
        'На каком конкретном примере вы проверите готовое решение?',
        'Дайын шешімді қандай нақты мысал арқылы тексересіз?')),
    ('scope', 'constraints', (
        'Что из задачи можно исключить из первой версии?',
        'Тапсырманың қай бөлігін алғашқы нұсқаға қоспауға болады?')),
    ('failure', 'expected_result', (
        'Какой нежелательный результат важно предотвратить?',
        'Қандай жағымсыз нәтижеге жол бермеу маңызды?')),
    ('pilot', 'users', (
        'Кто из пользователей сможет проверить первый прототип?',
        'Пайдаланушылардың қайсысы алғашқы прототипті тексере алады?')),
    ('handover', 'interaction_format', (
        'Как вы организуете передачу результата после демонстрации?',
        'Көрсетілімнен кейін нәтижені тапсыруды қалай ұйымдастырасыз?')),
)


def missing_fields(card: Card) -> list[str]:
    return [field for field in QUESTIONS if not filled(getattr(card, field))]


def extract_card(request: PrepareInput) -> Card:
    values = Card(title=request.description[:90], category=request.category, context=request.description).model_dump()
    for field, labels in ALIASES.items():
        label_pattern = '|'.join(re.escape(label) for label in (*labels, field))
        match = re.search(rf'(?im)^\s*(?:[-*]\s*)?(?:{label_pattern})\s*:\s*([^\n;]+)', request.description)
        if match:
            text = match.group(1).strip()
            values[field] = text if filled(text) else None
    sentences = re.split(r'(?<=[.!?])\s+|\n|;', request.description)
    for field, pattern in CUES.items():
        # An explicit labelled value (including "unknown") takes precedence.
        labels = '|'.join(re.escape(label) for label in (*ALIASES[field], field))
        if re.search(rf'(?im)^\s*(?:[-*]\s*)?(?:{labels})\s*:', request.description):
            continue
        match = next((sentence.strip() for sentence in sentences if re.search(pattern, sentence, re.I)), None)
        if match:
            values[field] = match
    for answer in request.answers:
        if not answer.answer.strip():
            continue
        for field in answer.fields:
            text = answer.answer if filled(answer.answer) else None
            if text and answer.question_id.startswith('detail_') and values[field]:
                text = f'{values[field]}\n{text}'[:6000]
            values[field] = text
    return Card.model_validate(values)


def question_key(text: str) -> str:
    return ' '.join(re.findall(r'\w+', text.casefold()))


def clarification_questions(card: Card, request: PrepareInput, locale: Locale, candidates: list[Question] | None = None) -> tuple[list[Question], bool]:
    missing = missing_fields(card)
    answered_ids = {answer.question_id for answer in request.answers if filled(answer.answer)}
    answered_texts = {question_key(answer.question) for answer in request.answers if filled(answer.answer)}
    selected: list[Question] = []
    ids, texts = set(), set()
    used_fields = set()
    repaired = False

    def add(question: Question, *, distinct_fields: bool = False) -> bool:
        key = question_key(question.text)
        if (not key or not question.fields or question.id in ids or key in texts
                or question.id in answered_ids or key in answered_texts
                or (distinct_fields and set(question.fields) <= used_fields)):
            return False
        selected.append(question)
        ids.add(question.id)
        texts.add(key)
        used_fields.update(question.fields)
        return True

    for question in candidates or []:
        # Questions about filled fields are discarded. Extra detail questions are
        # deterministic below, so the model cannot repeatedly ask a known fact.
        if not set(question.fields).issubset(missing) or not add(question, distinct_fields=True):
            repaired = True
        if len(selected) == 5:
            break
    for field in missing:
        if len(selected) >= 3:
            break
        add(Question(id=f'q_{field}', fields=[field], text=QUESTIONS[field][locale == 'kk']), distinct_fields=True)
    for key, field, translations in DETAIL_QUESTIONS:
        if len(selected) >= 3:
            break
        add(Question(id=f'detail_{key}', fields=[field], text=translations[locale == 'kk']))
    # If all standard follow-ups were answered, ask for remaining additions,
    # explicitly allowing "none" rather than asking for those answers again.
    # 6 detail prompts plus 18 additions/example prompts leave at least three
    # distinct options even with the public limit of 20 previous answers.
    for kind in ('add', 'example'):
        for field in QUESTIONS:
            if len(selected) >= 3:
                break
            if field == 'title':
                continue
            label = field_label(field, locale)
            if kind == 'add':
                text = (
                    f'Есть ли ещё неописанные детали в разделе «{label}»? Если нет, это допустимый ответ.'
                    if locale == 'ru' else
                    f'«{label}» бөлімінде әлі сипатталмаған мәліметтер бар ма? Жоқ болса, солай жауап беруге болады.'
                )
            else:
                text = (
                    f'Можете привести ещё неописанный пример для раздела «{label}»? Если примера нет, укажите это.'
                    if locale == 'ru' else
                    f'«{label}» бөліміне әлі сипатталмаған мысал келтіре аласыз ба? Мысал болмаса, соны көрсетіңіз.'
                )
            add(Question(id=f'detail_{kind}_{field}', fields=[field], text=text))
    return selected, repaired or bool(candidates is not None and len(selected) > len(candidates))
