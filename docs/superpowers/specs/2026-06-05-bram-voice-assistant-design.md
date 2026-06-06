# Bram — Local-First Voice Morning Assistant

**Date:** 2026-06-05
**Status:** Design approved, pending spec review
**Author:** David Londoño (davidldv)

---

## 1. Summary

Bram is a personal, voice-first AI assistant for phones — a "Jarvis you actually own." The
product brand is **Bram**; the default in-app assistant persona is named **Zayn** and is
renameable per user.

The MVP centers on one daily-use loop: a **conversational morning briefing**. The user taps to
talk, says "good morning," and Bram speaks back a briefing of news headlines, planned items, and
the shape of their day. The same voice channel is used to *capture* plans ("remind me gym at 6").

The defining principle is **local-first privacy**: the user's personal data never leaves the
phone. The backend is a thin, stateless proxy that holds third-party API keys and stores nothing.
Cross-device sync is explicitly deferred and intended to become the paid tier (Obsidian model).

## 2. Goals

- Ship a daily-use voice assistant that gives a useful morning briefing.
- Capture plans/reminders conversationally and store them **locally** on device.
- Work the same on iOS and Android (React Native + Expo).
- Keep all personal data on-device; backend stores nothing.
- Establish "Bram" as the brand and "Zayn" as the default, renameable persona.

## 3. Non-Goals (explicitly out of MVP)

- **Cross-device sync** — deferred; becomes the future paid tier.
- **Wake word / always-listening** ("Hey Bram") — fights OS background-mic limits; v2+.
- **Calendar / third-party integrations** — app owns its data; no external calendar in MVP.
- **Personalized news ranking** — MVP uses topic-filtered headlines, not a learned model.
- **Accounts / login** — local-first MVP needs no user account.
- **Cloud speech (Whisper/ElevenLabs)** — MVP uses native on-device speech.

## 4. Architecture

Three layers. The phone owns all truth; the backend is a stateless key-holder.

```
┌─────────────────────────────────────────┐
│  Phone — React Native + Expo             │
│  • Voice capture (tap-to-talk)           │
│  • Native STT (speech → text)            │
│  • Conversation UI                       │
│  • Native TTS (text → speech)            │
│  • LOCAL store (SQLite via expo-sqlite): │
│      plans, reminders, prefs, topics     │  ← personal data never leaves device
└───────────────────┬──────────────────────┘
                    │ HTTPS — TEXT ONLY (no raw audio, no stored personal data)
┌───────────────────▼──────────────────────┐
│  Backend proxy — thin, stateless          │
│  • Holds API keys (LLM, news)             │
│  • POST /chat   POST /news                │
│  • Stores NOTHING (no DB in MVP)          │
│  • Rate limiting + abuse protection       │
└───────────────────┬──────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Claude API               News API
```

### Why a backend at all (given local-first)?

API keys for the LLM and news provider cannot be shipped in a mobile binary (they would be
extracted). The proxy exists solely to hold those secrets and apply rate limiting. It is
deliberately stateless: it receives the text context the app assembles, forwards it, and returns
the response. No personal data is persisted server-side.

## 5. Components

### 5.1 Mobile app (React Native + Expo)

- **Voice layer** — tap-to-talk control; native speech recognition for STT; native
  text-to-speech for playback (e.g. `expo-speech` for TTS plus a platform speech-recognition
  module for STT). No wake word.
- **Conversation UI** — chat-style transcript of the spoken exchange; tap-to-talk button; minimal
  surface for reviewing/editing captured plans.
- **Local store** — SQLite (`expo-sqlite`) holding plans, reminders, user preferences, and
  selected news topics. Single source of truth.
- **Context assembler** — gathers today's plans + selected topics, calls the proxy, and renders
  the reply.
- **Persona config** — assistant name (default "Zayn"), editable by the user.

### 5.2 Backend proxy (thin, stateless)

- `POST /chat` — receives assembled text context (system prompt + plans + headlines + user
  utterance), calls the Claude API, returns the reply.
- `POST /news` — receives selected topics, fetches from the news API, returns normalized
  headlines.
- Holds all third-party keys. Applies rate limiting and basic abuse protection. No database.

### 5.3 External services

- **LLM:** Claude API (model id to be pinned during implementation).
- **News:** a headlines news API (provider chosen during implementation).
- **Speech:** native on-device STT/TTS (no third-party speech service in MVP).

## 6. Data Model (local SQLite)

```
plan
  id            TEXT PRIMARY KEY
  type          TEXT      -- 'reminder' | 'event' | 'task'
  title         TEXT
  scheduled_at  INTEGER   -- epoch ms, nullable
  created_at    INTEGER
  done          INTEGER   -- 0 | 1

preference
  key           TEXT PRIMARY KEY
  value         TEXT      -- e.g. persona_name = 'Zayn'

news_topic
  id            TEXT PRIMARY KEY
  label         TEXT      -- 'tech' | 'world' | 'sports' | ...
  enabled       INTEGER
```

## 7. Key Flows

### 7.1 Morning briefing

1. User taps to talk → says "good morning."
2. App: native STT → text.
3. App: query local SQLite for today's plans; read enabled news topics.
4. App → `POST /news` with topics → proxy fetches headlines → returns them.
5. App assembles context: system prompt (persona = Zayn) + today's plans + headlines + utterance.
6. App → `POST /chat` → proxy → Claude → reply text.
7. App: native TTS speaks the reply; transcript shown in UI.

### 7.2 Capture loop

1. User taps to talk → "remind me gym at 6, lunch with Ana tomorrow."
2. App: native STT → text → `POST /chat` with an extraction instruction.
3. Claude returns structured items: `[{type, title, scheduled_at}, ...]`.
4. App writes items to local SQLite; confirms back by voice ("Got it — gym at 6, lunch with Ana
   tomorrow").

One voice channel, two jobs: briefing (read) and capture (write).

## 8. Privacy & Security

This is the product's core differentiator, not an afterthought.

- **Personal data never leaves the device.** Plans, reminders, preferences live only in local
  SQLite. The backend has no database and stores nothing.
- **Text-only egress.** Raw audio never leaves the phone (native STT runs on-device); only the
  text context needed for a given LLM/news call is sent, then discarded server-side.
- **Secrets on the server, never in the binary.** API keys live only in the proxy.
- **Transport:** HTTPS for all proxy calls.
- **Abuse protection:** rate limiting on proxy endpoints; consider lightweight attestation /
  anti-abuse to limit a leaked endpoint being used as a free LLM gateway.
- **At-rest (future):** when sync arrives, data syncs as client-encrypted ciphertext (keys on
  device) to preserve the local-first guarantee.

## 9. Tech Stack

- **App:** React Native + Expo, TypeScript.
- **Local DB:** `expo-sqlite`.
- **Speech:** native STT + `expo-speech` (TTS).
- **Backend:** Node.js (lightweight HTTP service), TypeScript; stateless; hosted on a small
  serverless or container target.
- **LLM:** Claude API.
- **News:** headlines API (TBD at implementation).

## 10. MVP Scope (definition of done)

A user can, on iOS and Android:

1. Tap to talk and receive a spoken morning briefing (headlines + today's plans).
2. Capture plans/reminders by voice; they persist locally across restarts.
3. Choose news topics.
4. Rename the assistant persona (default "Zayn").

All personal data remains on-device; the backend persists nothing.

## 11. Future (post-MVP, ordered)

1. **Sync (paid tier)** — client-encrypted cross-device sync; the subscription feature.
2. **Personalized news** — learned topic ranking from interaction history.
3. **Cloud speech option** — higher-quality STT/TTS for users who opt in.
4. **Proactive nudges** — reminders/notifications at the right time.
5. **Wake word** — "Hey Bram," within OS background constraints.

## 12. Open Questions (resolve during planning)

- Which Claude model id to pin for cost/latency/quality on mobile briefings.
- Which native STT module on each platform; quality and language coverage (incl. Spanish).
- Which news API (coverage, cost, rate limits).
- Backend hosting target and how to mitigate proxy-endpoint abuse without accounts.
