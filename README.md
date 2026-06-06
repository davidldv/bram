# Bram Proxy

Thin, stateless proxy for the Bram app. Holds the Claude + news API keys; stores nothing.

## Endpoints
- `POST /chat` — `{ system, messages }` → `{ reply }`
- `POST /news` — `{ topics }` → `{ headlines }`
- `GET /health` — `{ ok: true }`

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in keys.
3. `npm run dev` (watch) or `npm run build && npm start`.

## Test
`npm test`

## Design
Stateless by design — no database, no personal data. See
`docs/superpowers/specs/2026-06-05-bram-voice-assistant-design.md`.
