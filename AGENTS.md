# Tubi hackathon workspace

## Scope and ownership
- Participant 1: `web/src/features/business/`, `web/src/shared/`, `web/src/App.tsx`, frontend configuration.
- Participant 2: `web/src/features/marketplace/` only. Export screens; participant 1 connects navigation.
- Participant 3 (repository owner): `server/`, `contracts/`, `README.md`, `.gitignore`.
- Read `contracts/api.md` before changing data formats. Coordinate any contract change.
- Each participant uses a separate branch. Do not overwrite another participant's uncommitted changes.
- Ask the team before changing dependencies or files owned by another participant.

## Product rules
- All published tasks remain visible regardless of score. Students choose tasks themselves.
- Human confirmation is required before saving final card content and publishing it.
- Scores are calculated by `server/app/rating.py`, never by the language model.
- AI copies facts from supplied text only. Unknown facts remain null. Fallback must be labeled.
- Business manually accepts/rejects proposals. Selecting one team does not reject others.
- The app has demo roles only; it is a local hackathon prototype, not an authenticated service.
- Do not commit `.env`, credentials, `.venv`, `node_modules`, built assets, or the runtime database.

## Verification
- Frontend: `cd web && npm run build`.
- Backend: install `server/requirements-dev.txt`, then `python -m unittest discover -s server/tests -v` with `PYTHONPATH=server`.
- Smoke scenario: draft → questions → editable card → rating → confirm/publish → team proposal → business decision.
- See README for two-terminal development and one-server demonstration.
