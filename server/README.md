# Bram Proxy

Thin, stateless proxy for the Bram app. Holds the LLM (OpenRouter) + news API keys;
stores nothing.

## Endpoints
- `POST /chat` — `{ system, messages }` → `{ reply }`
- `POST /news` — `{ topics }` → `{ headlines }`
- `DELETE /account` — deletes the caller's Supabase user (backup row cascades);
  mounted only when `SUPABASE_SERVICE_ROLE_KEY` is set
- `GET /health` — `{ ok: true }` (open, for liveness checks)

`/chat` and `/news` require a Supabase user JWT (`Authorization: Bearer <token>`),
verified locally against the project JWKS when `SUPABASE_URL` is set. Requests are
rate-limited per user id. The app signs installs in anonymously, so no signup wall —
enable **Anonymous sign-ins** in the Supabase dashboard (Authentication → Sign In/Up).
Leave `SUPABASE_URL` unset only for local dev — the server warns on startup.

## Setup
1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in keys.
3. `pnpm dev` (watch) or `pnpm build && pnpm start`.

## Test
`pnpm test`

## Design
Stateless by design — no database, no personal data. See
`../docs/superpowers/specs/2026-06-05-bram-voice-assistant-design.md`.
