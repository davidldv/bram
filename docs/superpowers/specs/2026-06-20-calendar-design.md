# Bram — Calendar Integration (read-only)

Date: 2026-06-20
Status: Approved (design); implementing

## Goal

Let Bram see your real schedule. Read the device calendar and surface those
events in the Agenda and the morning briefing, so "your day" reflects actual
meetings — not just voice-captured plans. This is the context layer that later
powers proactivity. Local-first preserved: calendar data is read on-device and
only flows to the LLM as the briefing text Bram already sends.

## Scope (v1)

- **Read-only.** Show device-calendar events in Agenda + briefing.
- **No write, no dedup.** Captured "event" plans stay local exactly as today;
  nothing is written to the device calendar, so there is no read-back
  duplication to manage. (Write deferred.)
- Requires a native rebuild (`expo-calendar`).

## Dependency

- `expo-calendar` (SDK 56-compatible via `expo install`). Read the versioned
  docs at https://docs.expo.dev/versions/v56.0.0/ before native-facing code
  (per app/AGENTS.md).

## Components

### `CalendarService` — `src/calendar/calendar.ts`

```ts
export interface CalendarEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number | null;
  allDay: boolean;
}
export interface CalendarService {
  listEvents(startMs: number, endMs: number): Promise<CalendarEvent[]>;
}
```

- Real impl: request calendar permission (lazily, on first call); if not
  granted, return `[]`. Otherwise `getCalendarsAsync(EntityTypes.EVENT)` →
  `getEventsAsync(calendarIds, new Date(startMs), new Date(endMs))`, mapped to
  `CalendarEvent` (title fallback to "(busy)" when empty; `allDay` from the
  event; `endMs` null when absent). Best-effort: errors resolve to `[]` so they
  never break Agenda or briefing.
- `createNoopCalendar(): CalendarService` → always `[]`, for tests and the
  permission-denied path wiring.
- Added to the `Services` container and `build-services`.

`CalendarEvent` type lives in `src/core/types.ts`.

### Agenda merge — `src/core/agenda.ts` (pure)

```ts
export type AgendaItem =
  | { kind: "plan"; plan: Plan }
  | { kind: "event"; event: CalendarEvent };
export interface AgendaGroup { group: PlanGroup; items: AgendaItem[] }
export function buildAgenda(plans: Plan[], events: CalendarEvent[], now: number): AgendaGroup[];
```

- Groups both plans (by `scheduledAt`) and events (by `startMs`) into
  Today / Upcoming / Someday using the existing `planGroup`. Events always have a
  time, so they never fall in Someday.
- Within a group: sort by time (plans use `scheduledAt`, events use `startMs`;
  done plans sort last), stable for items without a time.
- Returns only non-empty groups, in Today → Upcoming → Someday order.
- Pure → unit-tested. This is the only non-trivial new logic.

### `EventCard` — `src/ui/EventCard.tsx`

Read-only row: calendar icon (event accent color), title, time range
(`formatRelative(now, startMs)`, plus end time when present). No checkbox, no
delete. Visually distinct from `PlanCard` so device events read as "from your
calendar".

### Agenda screen — `src/screens/AgendaScreen.tsx`

- On load: `plans.list()` and `calendar.listEvents(startOfToday, +14 days)`.
- Render `buildAgenda(plans, events, now)`: `PlanCard` (with mark-done) for
  plan items, `EventCard` for event items, under each group `Section`.
- Empty state unchanged (no plans and no events).
- Mark-done still only applies to plans (events are read-only).

### Briefing — `src/core/briefing.ts` + `briefing-service.ts`

- `buildBriefingPrompt` gains `events: CalendarEvent[]` and renders a "Today's
  calendar:" section (time + title; "(nothing scheduled)" when empty).
- `morningBriefing` gains a `calendar: CalendarService` dep, fetches today's
  events via `dayRange(now)`, and passes them in.
- `runTurn`'s briefing branch passes `deps.calendar` through.

## Permission UX

Requested lazily inside the real `CalendarService` on first `listEvents`. If
denied: Agenda shows local plans only; briefing's calendar section is empty. No
re-prompt loop. `ponytail:` revisit if users miss the connection.

## Data flow

Plans remain local SQLite (source of truth for captured items). Calendar events
are read fresh from the device each time Agenda loads or a briefing runs; never
stored by Bram. Merge happens in the pure `buildAgenda` (Agenda) and in the
briefing prompt (briefing).

## Error handling

- Permission denied or any expo-calendar error → `[]` (Agenda/briefing degrade
  to local-only). No new error UI.
- Existing briefing/runTurn try/catch unchanged.

## Testing

- Pure: `buildAgenda` (merges + groups plans and events; sorts by time within a
  group; done plans last; empty → []); `buildBriefingPrompt` (renders the
  calendar section; "(nothing scheduled)" when empty).
- `morningBriefing`: with a mock `CalendarService` returning an event, the event
  reaches the prompt; with noop calendar, briefing still works.
- Existing `briefing-service` / `services` / `ConversationScreen` test mocks get
  a `calendar` service added (noop).
- Real `calendar.ts` + on-device read verified after the rebuild: with a real
  device-calendar event in the next 14 days, it appears in the Agenda; with
  permission denied, Agenda still shows local plans.

## Out of scope (deferred)

- Writing captured events to the device calendar (and the dedup that needs).
- Editing/deleting device events from Bram.
- Choosing which calendars to include (v1 reads all event calendars).
- Recurring-event nuances beyond what `getEventsAsync` already expands.

## File summary

- New: `src/calendar/calendar.ts`, `src/core/agenda.ts`,
  `src/core/agenda.test.ts` (or `__tests__/`), `src/ui/EventCard.tsx`.
- Edit: `src/core/types.ts`, `src/app/services.tsx`, `src/app/build-services.ts`,
  `src/screens/AgendaScreen.tsx`, `src/core/briefing.ts`,
  `src/core/briefing-service.ts`, `src/app/turn.ts`, `app.json`, and the
  briefing / services / ConversationScreen test mocks.
- Untouched: backend, notifications, memory store, voice/speech, UI theme.
