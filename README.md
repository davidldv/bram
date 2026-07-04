# Bram

A personal, voice-first AI assistant for phones — a "Jarvis you actually own." The product
brand is **Bram**; the default in-app persona is **Zayn** (renameable per user).

The core loop is a **conversational morning briefing**: tap to talk, say "good morning," and
Bram speaks back your news headlines, planned items, and the shape of your day. The same voice
channel captures plans ("remind me gym at 6").

**Local-first by design.** Your personal data lives on-device in SQLite and never leaves the
phone. The backend is a thin, stateless proxy that only holds third-party API keys.

## Layout

- **`app/`** — React Native + Expo (SDK 56) client. On-device STT/TTS, SQLite store,
  conversation UI, agenda, graph view, notifications, calendar, optional account + sync.
- **`server/`** — `bram-proxy`, a stateless Express proxy. Holds the LLM (OpenRouter) and news
  API keys, verifies Supabase user JWTs, rate-limits per user. Stores nothing. See
  [`server/README.md`](server/README.md).
- **`supabase/`** — SQL for the optional encrypted-backup table used by cross-device sync.
- **`docs/`** — design specs and implementation plans (`docs/superpowers/`), plus the
  [privacy policy](docs/privacy-policy.md).

## Run it

**App** (from `app/`):
```
pnpm install
pnpm start        # Expo dev server; or pnpm android / pnpm ios
```

**Proxy** (from `server/`):
```
pnpm install
cp .env.example .env   # fill in OpenRouter + news keys, SUPABASE_URL
pnpm dev               # watch mode; or pnpm build && pnpm start
```

The app reads `backendBaseUrl`, `supabaseUrl`, and `supabaseAnonKey` from `app/app.json`.

## Test

- App: `cd app && pnpm test` (Jest)
- Proxy: `cd server && pnpm test` (Vitest)

## License

See [`app/LICENSE`](app/LICENSE).
