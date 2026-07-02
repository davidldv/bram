# Bram Privacy Policy

_Last updated: July 1, 2026_

> **Draft.** Review before publishing; this is a plain-language starting point,
> not legal advice. Host the final version at a public URL and link it from both
> store listings.

Bram is a local-first voice assistant. The short version: **your personal data
lives on your phone, and we cannot read what you back up.**

## What stays on your device

Everything Bram knows about you — your plans, reminders, memories, preferences,
news topics, and the assistant's notes about your life — is stored in a local
database on your phone. It is never uploaded in readable form. Deleting the app
deletes this data.

Voice input is transcribed on your device using your phone's built-in speech
recognition. Bram never records or uploads audio.

## What leaves your device

- **Conversation text.** When you talk to Bram, the text of the conversation
  (not audio) is sent over HTTPS to our proxy server, which forwards it to a
  third-party AI model provider (via OpenRouter) to generate the reply. Our
  proxy stores nothing — no database, no logs of your conversations. Model
  providers process the text to produce a response and may retain it according
  to their own policies. Do not include information in conversations you would
  not send to a cloud service.
- **News topics.** Your chosen topics (e.g. "technology") are sent to a news
  service to fetch headlines. Topics are not tied to your identity.
- **Encrypted backups (optional).** If you create an account, Bram can back up
  your data to our cloud storage. Backups are encrypted on your device with
  keys derived from your password before upload — we store only ciphertext and
  cannot decrypt it. If you lose your password and recovery code, your backup
  is unrecoverable, by design.

## Your account

Creating an account is optional; Bram works fully without one. If you sign up,
we store your email address (for sign-in) and your encrypted key bundle. To
authenticate API requests, the app may also create an anonymous account tied to
your install — it contains no personal information.

You can delete your account and all server-side data at any time from
Settings → Delete account. Local data on your phone is unaffected.

## Permissions

- **Microphone & speech recognition** — to hear you and convert speech to text,
  on demand only.
- **Calendar (read)** — to include your schedule in briefings; calendar data
  stays on device.
- **Notifications** — to deliver reminders you asked for.

## What we don't do

No ads, no analytics SDKs, no selling or sharing of personal data, no tracking
across apps.

## Contact

dlondon.dev@gmail.com
