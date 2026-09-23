from typing import Annotated, Generic, Literal, TypeVar
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints, field_validator

Category = Literal['analytics', 'automation', 'education', 'marketing', 'other']
CardField = Literal['title', 'context', 'need', 'users', 'data', 'expected_result', 'success_criteria', 'constraints', 'contact', 'interaction_format']
Level = Literal['draft', 'working', 'ready', 'priority']
Sort = Literal['score_desc', 'newest']
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
    confirmed: StrictBool


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


class PrepareResponse(AIResult):
    mode: Literal['live', 'fallback']
    warnings: list[str]


class Breakdown(StrictModel):
    key: str
    earned: int = Field(ge=0, le=20)
    max: int = Field(ge=0, le=20)


class Improvement(StrictModel):
    fields: list[CardField]
    message: str


class Rating(StrictModel):
    score: int = Field(ge=0, le=100)
    level: Level
    breakdown: list[Breakdown]
    improvements: list[Improvement]


class Task(StrictModel):
    id: str
    card: Card
    rating: Rating
    confirmed: bool
    status: Literal['draft', 'published']
    created_at: str
    updated_at: str


class Team(StrictModel):
    id: str
    name: str
    interests: list[str]
    skills: list[str]
    technologies: list[str]


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


class ReviewInput(StrictModel):
    rating: int = Field(strict=True, ge=1, le=5)
    comment: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ProposalReview(ReviewInput):
    created_at: str


class Proposal(ProposalInput):
    id: str
    task_id: str
    status: Literal['pending', 'accepted', 'rejected']
    created_at: str
    milestone_confirmed: bool
    points: int = Field(ge=0)
    review: ProposalReview | None = None


Item = TypeVar('Item')


class Items(StrictModel, Generic[Item]):
    items: list[Item]


class Health(StrictModel):
    status: Literal['ok']
    ai_mode: Literal['live', 'fallback']


class ErrorDetail(StrictModel):
    code: str
    message: str
    fields: list[str]


class ErrorResponse(StrictModel):
    error: ErrorDetail
