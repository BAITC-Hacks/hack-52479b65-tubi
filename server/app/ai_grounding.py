"""Internal model format and conservative extractive evidence verification."""
from typing import Literal

from pydantic import Field

from .schemas import Card, CardField, Category, PrepareInput, Question, StrictModel
from .rating import filled


class Evidence(StrictModel):
    field: CardField
    quote: str = Field(min_length=1, max_length=6000)
    source: Literal['description', 'answer']
    answer_index: int | None


class ExtractedCard(Card):
    # Provider schemas require explicit values, not a default category.
    category: Category = Field(...)


class GroundedResult(StrictModel):
    card: ExtractedCard
    questions: list[Question]
    evidence: list[Evidence]


def grounded_card(result: GroundedResult, request: PrepareInput) -> tuple[Card, list[str]]:
    values = result.card.model_dump()
    rejected = []
    for field in Card.model_fields:
        if field == 'category':
            values[field] = request.category
            continue
        value = values[field]
        if not filled(value):
            values[field] = None
            continue
        supported = False
        for evidence in result.evidence:
            if evidence.field != field:
                continue
            if evidence.source == 'description' and evidence.answer_index is None:
                source = request.description
            elif (evidence.source == 'answer' and evidence.answer_index is not None
                  and 0 <= evidence.answer_index < len(request.answers)):
                source = request.answers[evidence.answer_index].answer
            else:
                continue
            # Both comparisons are exact and case-sensitive. A genuine quote
            # alone cannot justify invented numbers attached to the value.
            if evidence.quote in source and value == evidence.quote.strip():
                supported = True
                break
        if not supported:
            values[field] = None
            rejected.append(field)
    return Card.model_validate(values), rejected
