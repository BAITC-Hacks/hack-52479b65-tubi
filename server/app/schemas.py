from typing import Annotated, Literal
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Category = Literal['analytics', 'automation', 'education', 'marketing', 'other']
CardField = Literal['title', 'context', 'need', 'users', 'data', 'expected_result', 'success_criteria', 'constraints', 'contact', 'interaction_format']
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Card(StrictModel):
    title: Text | None = None
    category: Category = 'analytics'
    context: Text | None = None
    need: Text | None = None
    users: Text | None = None
    data: Text | None = None
    expected_result: Text | None = None
    success_criteria: Text | None = None
    constraints: Text | None = None
    contact: Text | None = None
    interaction_format: Text | None = None

    @field_validator('*', mode='before')
    @classmethod
    def strip_empty(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class EvaluateInput(StrictModel):
    card: Card


class SaveInput(EvaluateInput):
    confirmed: bool


class Answer(StrictModel):
    question_id: Annotated[str, StringConstraints(max_length=80)]
    fields: list[CardField] = Field(min_length=1, max_length=10)
    question: Text
    answer: Text


class PrepareInput(StrictModel):
    stage: Literal['clarify', 'compose']
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=6000)]
    category: Category
    answers: list[Answer] = Field(default_factory=list, max_length=20)


class Question(StrictModel):
    id: str
    fields: list[CardField]
    text: str


class AIResult(StrictModel):
    card: Card
    questions: list[Question]
    missing_fields: list[CardField]


class ProposalInput(StrictModel):
    team_id: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    idea: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=3000)]
    plan: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=3000)]
    deadline: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    prototype_url: Annotated[str, StringConstraints(max_length=1000)] | None = None

    @field_validator('prototype_url')
    @classmethod
    def valid_url(cls, value):
        if not value or not value.strip():
            return None
        parsed = urlparse(value.strip())
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('Укажите ссылку http:// или https://')
        return value.strip()


class DecisionInput(StrictModel):
    status: Literal['accepted', 'rejected']
