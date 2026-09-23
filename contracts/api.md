# Tubi API contract v1

Base URL: `/api`. UTF-8 JSON. IDs are strings. Timestamps are ISO 8601 UTC. Frontend types: `types.ts`; backend validation: `server/app/schemas.py`; examples: `fixtures.json`. The included app uses the real local API and SQLite. Fixtures are for isolated frontend development; they are not presented as live AI.

## Card

All fields are present in responses. `category` is one of `analytics`, `automation`, `education`, `marketing`, `other`. Other fields are `string | null`: `title`, `context`, `need`, `users`, `data`, `expected_result`, `success_criteria`, `constraints`, `contact`, `interaction_format`. Whitespace-only values normalize to null. Text is limited to 6000 characters. AI must not fill unknown facts.

## Task

`{id, card: Card, rating: Rating, confirmed: boolean, status: "draft" | "published", created_at, updated_at}`.
Publication state is independent of readiness level: a published task with readiness `draft` is visible and accepts proposals.

## Rating

`{score: number, level: "draft" | "working" | "ready" | "priority", breakdown: [{key, earned, max}], improvements: [{fields: CardField[], message}]}`.
Scores use the rules in README and `rating.py`. `/evaluate` is a preview; saving confirms the current card and recalculates on the server.

## AI preparation

`POST /ai/prepare`

Request: `{stage: "clarify" | "compose", category, description: string, answers: [{question_id, fields: CardField[], question, answer}]}`.
Description length: 5–6000; maximum 20 answers. First call uses `stage=clarify, answers=[]`. Second call repeats the original description/category and sends the answered questions using `stage=compose`.

Response: `{mode: "live" | "fallback", card: Card, questions: [{id, fields: CardField[], text}], missing_fields: CardField[], warnings: string[]}`.
Clarify returns at least 3 relevant questions; compose returns an empty questions array. No database mutation occurs here. Missing key, timeout, refusal, malformed output, or invalid questions fall back to deterministic templates. UI displays the warning. Structured format does not guarantee factual correctness; the editor and human confirmation remain mandatory.

## Endpoints

| Method and path | Input | Output |
| --- | --- | --- |
| GET /health | — | `{status: "ok", ai_mode: "live" | "fallback"}` (live means key configured) |
| POST /tasks/evaluate | `{card: Card}` | Rating |
| POST /tasks | `{card: Card, confirmed: true}` | Task, status=draft, HTTP 201 |
| PUT /tasks/{id} | `{card: Card, confirmed: true}` | Updated Task; publication status preserved |
| POST /tasks/{id}/publish | `{}` | Task, status=published; title and confirmation required |
| GET /tasks | `category?`, `level?`, `sort=score_desc|newest`, `include_drafts=false` | `{items: Task[]}` |
| GET /tasks/{id} | — | Task |
| GET /teams | — | `{items: Team[]}` |
| GET /proposals | — | `{items: Proposal[]}` (demo overview) |
| GET /tasks/{id}/proposals | — | `{items: Proposal[]}` |
| POST /tasks/{id}/proposals | ProposalInput | Proposal, HTTP 201; only published tasks |
| PATCH /proposals/{id} | `{status: "accepted" | "rejected"}` | Proposal; manual decision, independent per proposal |
| POST /proposals/{id}/milestone | `{}` | Proposal; accepted only; grants 50 points once |

## Teams and proposals

Team: `{id, name, interests: string[], skills: string[], technologies: string[]}`.
ProposalInput: `{team_id, idea, plan, deadline, prototype_url: string | null}`. Idea and plan each 5–3000 characters; deadline 1–200 characters. URLs must be http/https.
Proposal adds `{id, task_id, status: "pending" | "accepted" | "rejected", created_at, milestone_confirmed: boolean, points: number}`.
There is no global cap on proposals and no automatic assignment. Repeating the same decision is idempotent; changing an already completed decision returns 409. Milestone confirmation is also idempotent.

## Errors

`{"error":{"code":"VALIDATION_ERROR","message":"Readable explanation","fields":["card.title"]}}`.
200 success, 201 creation, 422 invalid input/confirmation, 404 missing record, 409 invalid lifecycle action. Other HTTP errors use `HTTP_<status>` as code.

## Demo roles

The UI switch is not authentication. There is one shared business workspace and five selectable teams. `include_drafts=true` is for the demo business view. Do not expose the prototype publicly with real data. Add authentication and owner checks before that use case.
