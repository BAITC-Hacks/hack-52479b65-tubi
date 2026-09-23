# Tubi API contract v1 — backend quality

Base URL: `/api`. UTF-8 JSON. IDs are strings. Timestamps are ISO 8601 UTC. Frontend types: `types.ts`; backend validation: `server/app/schemas.py`; examples: `fixtures.json`. The included app uses the real local API and SQLite. Fixtures are for isolated frontend development; they are not presented as live AI.

## Backend quality handoff — both frontend participants

- Existing routes and public JSON field names/types are preserved. No frontend migration is required.
- Optional `Accept-Language: ru | kk` localizes AI questions, fallback questions, warnings, errors and rating improvement messages. The default and unsupported-language fallback are `ru`. Regional tags and weighted lists are accepted. User content is never automatically translated. Set this header in the shared HTTP adapter when the UI locale changes.
- Keep displaying all `warnings`, including in `mode=live`: individual facts can fail evidence verification. `mode=live` means a completed model response was used; some questions may still be replaced with local templates, with an explicit warning.
- `questions` remain `{id, fields, text}`; IDs are opaque, not field names. `clarify` returns at least three distinct questions. With fewer than three missing fields, follow-up questions ask for additional details. `compose` still returns `questions=[]`.
- `confirmed` must be a JSON boolean, not a string or number. Unknown input fields, including server-owned rating/status/points, return 422.
- Every endpoint declares a response model. Error envelopes now also cover server errors (500) and SQLite lock contention (503); retry a temporary failure without clearing the user's form.
- Internal evidence never appears in JSON. TypeScript card/task/proposal interfaces need no changes. New fixture keys add Kazakh and compose examples while keeping all existing fixture keys.
- Demo reliability update: no new routes, request fields, response fields or frontend migration. AI failures now have distinct localized warnings for authentication, connection, timeout and provider limits; continue displaying `warnings` as text. Questions must fit the existing answer limits (ID 80, text 6000, at most 10 target fields), otherwise the server uses fallback before returning them.
- Team review addition: every proposal now includes `review: null | {rating, comment, created_at}`. `POST /proposals/{id}/review` saves one business review after selection and milestone confirmation. Older SQLite records are returned with `review=null`; no data reset or schema migration is needed.

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
Clarify returns at least 3 relevant questions; compose returns an empty questions array. No database mutation occurs here. Missing key, timeout, refusal, incomplete or malformed output, or structurally invalid questions fall back to deterministic templates. UI displays the warning. Questions targeting known fields are replaced with local questions about remaining gaps. Already answered question IDs/texts are skipped.

For every generated text field, the internal result supplies an exact excerpt and a reference to `description` or one `answers[i].answer`. The excerpt must exist in that source, and the field value must equal the trimmed excerpt. Unsupported facts become `null` and appear in `missing_fields` and a localized warning, including during compose. They are not silently restored. Clear source facts omitted by the model may be copied by the local extractor. Category is always taken from the request. This is conservative extraction, not semantic proof: field assignment, relevance and contradictions still require human review.

Fallback copies explicit labels (Russian, Kazakh and field names), a small set of sentence patterns and user answers; it cannot understand every free-form description. An empty label never takes content from the next line. Blank answers do not erase existing facts. Unknown-placeholder answers to a base question clear its field; unknown answers to optional `detail_*` questions preserve the existing fact. Substantive `detail_*` answers extend the existing field, within the 6000-character limit. `mode=fallback` always includes a warning and is never described as live generation. An AI response prepares a card in memory; it does not save it to SQLite until the separate confirmed save request.

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
| POST /proposals/{id}/review | `{rating: integer 1..5, comment: string}` | Proposal with review; accepted + milestone confirmed only |

## Teams and proposals

Team: `{id, name, interests: string[], skills: string[], technologies: string[]}`.
ProposalInput: `{team_id, idea, plan, deadline, prototype_url: string | null}`. Idea and plan each 5–3000 characters; deadline 1–200 characters. URLs must be http/https.
Proposal adds `{id, task_id, status: "pending" | "accepted" | "rejected", created_at, milestone_confirmed: boolean, points: number, review: ProposalReview | null}`.
There is no global cap on proposals and no automatic assignment. Repeating the same decision is idempotent; changing an already completed decision returns 409. Milestone confirmation is also idempotent.

### Business review after completed work

`ProposalReview` is `{rating: integer 1..5, comment: string, created_at: string}`. The business can leave a review for an accepted proposal after confirming its completed milestone. Each proposal has at most one review; there is no automatic review or additional points award.

```json
{"rating": 5, "comment": "Команда передала понятный прототип и учла обратную связь."}
```

The server trims comment whitespace and requires 1–2000 characters. Rating must be a JSON integer; booleans, strings, fractional values and values outside 1–5 are rejected with 422. Unknown fields, including client-supplied `created_at`, are also rejected. The server sets the timestamp and stores the review with the proposal in the same SQLite write transaction.

Success returns HTTP 200 and the complete proposal. Repeating the same rating and normalized comment returns the original review and timestamp. Different content after a review exists returns 409 without changing the saved review. Unselected or incomplete proposals return 409, a missing proposal returns 404. Error messages honor `Accept-Language`; the user's comment is never automatically translated. Both proposal list routes include the review. This remains a demo business role, not authenticated review ownership.

## Errors

`{"error":{"code":"VALIDATION_ERROR","message":"Readable explanation","fields":["card.title"]}}`.
200 success, 201 creation, 422 invalid input/confirmation, 404 missing record, 409 invalid lifecycle action, 500 unexpected failure, 503 busy database. Other HTTP errors use `HTTP_<status>` as code. `VALIDATION_ERROR` is stable; `message` is localized and should not be parsed as a code. Logs and error responses omit raw descriptions, credentials and provider error details.

SQLite lock errors, including extended busy/locked codes, return `Retry-After: 1` with HTTP 503. This header suggests when a retry can be attempted; it does not trigger an automatic retry or guarantee success.

## Demo roles

The UI switch is not authentication. There is one shared business workspace and five selectable teams. `include_drafts=true` is for the demo business view. Do not expose the prototype publicly with real data. Add authentication and owner checks before that use case.
