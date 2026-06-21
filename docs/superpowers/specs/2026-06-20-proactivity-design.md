# Bram — Proactivity (calendar lead-time heads-ups)

Date: 2026-06-20
Status: Approved (design); implementing

## Goal

Make Bram reach out before you ask — the payoff of the Notifications + Calendar
work. v1: a local heads-up notification a fixed lead time before each upcoming
device-calendar event ("Team sync in 10 minutes"). Calendar events currently
have no notifications at all, so this is the clearest proactive win. Local-first
preserved: scanning and scheduling happen on-device; nothing new leaves it.

## Mechanism (and why)

Mobile background execution is unreliable (Android throttles background tasks,
costs battery, fires unpredictably). Instead Bram **pre-schedules** local
notifications when the app opens: the OS then fires them even while Bram is
closed, with zero background compute. Re-scanning on each open is idempotent via
deterministic notification ids.

Explicitly NOT doing (declined in design):
- Background periodic checks (`expo-background-task`).
- Timed-plan lead-ups (plans already fire at their time; a lead-up would
  double-notify).
- On-open proactive greeting text.
- Overdue / forgotten-item nudges.

## Scope (v1)

- One heads-up per upcoming, **timed** calendar event, `LEAD_MS` (10 minutes)
  before its start.
- Refreshed on app open. No native rebuild (reuses `expo-notifications` and
  `expo-calendar`, both already linked).

## Pure core — `src/core/proactivity.ts`

```ts
export interface ScheduledNote {
  id: string;
  title: string;
  body: string;
  whenMs: number;
}
export function planLeadups(
  events: CalendarEvent[],
  now: number,
  leadMs: number
): ScheduledNote[];
```

For each event:
- Skip `allDay` events (no meaningful "10 min before").
- Compute `whenMs = startMs - leadMs`; skip when `whenMs <= now` (already
  started or inside the lead window — can't fire in the past).
- Emit `{ id: \`evt-${event.id}\`, title: event.title, body: "In 10 minutes", whenMs }`.

Pure → unit-tested. The deterministic `evt-<id>` identifier makes re-scheduling
on each app open idempotent (a re-scheduled identifier replaces the pending
notification rather than duplicating).

## Orchestrator — `syncProactiveNotifications(deps)`

```ts
export async function syncProactiveNotifications(deps: {
  calendar: CalendarService;
  notifier: Notifier;
  now: number;
}): Promise<void>;
```

- `events = await deps.calendar.listEvents(now, now + HORIZON_DAYS * day)`
  (HORIZON_DAYS = 14).
- For each `planLeadups(events, now, LEAD_MS)` note: `await deps.notifier.scheduleAt(note)`.
- Best-effort: calendar denied/error → `[]` (already), notifier without
  permission → no-op (already). Never throws to the caller.

## Notifier addition — `src/notify/notifier.ts`

Add to the `Notifier` interface:

```ts
scheduleAt(note: { id: string; title: string; body: string; whenMs: number }): Promise<void>;
```

- Real impl: `scheduleNotificationAsync({ identifier: id, content: { title, body },
  trigger: { type: DATE, date: new Date(whenMs) } })`, guarded by the existing
  lazy permission + Android channel setup. The existing `schedule(plan)` is
  refactored to delegate to `scheduleAt` (title = plan.title, body = "From
  {persona}", whenMs = plan.scheduledAt).
- Noop impl: add a no-op `scheduleAt`.

## Trigger point — `App.tsx`

Once `services` is set, fire-and-forget:
`syncProactiveNotifications({ calendar, notifier, now: Date.now() }).catch(() => {})`.

`ponytail:` app-open refresh only. Events added externally while the app stays
closed for days won't get a heads-up until the next open (the background-task
upgrade was declined).

## Config

`LEAD_MS = 10 * 60 * 1000` constant in `proactivity.ts`. `ponytail:` promote to
a Settings value if users want to tune it.

## Stale events

If an event is deleted externally after its heads-up is scheduled, the heads-up
still fires once. Rare edge; `ponytail:` cancel `evt-`-prefixed pending
notifications before re-scheduling if it proves annoying.

## Error handling

All best-effort and silent (proactivity must never break app startup). Calendar
and notifier already degrade gracefully on permission denial.

## Testing

- Pure `planLeadups`: future timed event → one note at `start − 10min` with
  `evt-<id>`; event already within the lead window or past → skipped; all-day →
  skipped; empty → [].
- `syncProactiveNotifications`: mock calendar returning a future event + spy
  notifier → `scheduleAt` called once with the expected id/whenMs; past event →
  not called.
- Existing notifier test mocks gain a no-op `scheduleAt`.
- On device: the existing "Team sync (cal test)" events (~2h out) → a heads-up is
  scheduled; verify the pending notification via `dumpsys`.

## Out of scope (deferred)

- Background refresh of nudges while the app is closed.
- Configurable lead time / per-event lead time.
- Lead-ups for timed plans; overdue/forgotten nudges; on-open greeting text.
- Cancelling heads-ups for externally-deleted events.

## File summary

- New: `src/core/proactivity.ts`, `src/core/proactivity.test.ts` (or
  `__tests__/`).
- Edit: `src/notify/notifier.ts` (`scheduleAt` + delegate `schedule`),
  `App.tsx` (call sync on services ready), and the notifier test mocks.
- Untouched: backend, calendar/memory/briefing logic, UI, db.
