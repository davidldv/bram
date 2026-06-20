# Bram — Local Notifications for Timed Plans

Date: 2026-06-20
Status: Approved (design); pending implementation plan

## Goal

Close the broken core loop: a captured reminder/event with a time must actually
fire a notification at that time. Today plans are persisted to SQLite and
nothing ever alerts the user, which makes capture a note-taker rather than an
assistant. This adds **local** (on-device) scheduled notifications — no server,
no push service, nothing leaves the device (consistent with Bram's local-first
privacy thesis).

## Scope (v1)

- Timed items fire **at** their `scheduledAt` time. No lead time, no recurrence
  (both explicitly deferred).
- Notifications are **tap-to-open** (open the app on the Agenda tab). No action
  buttons, no snooze, no background mark-done (deferred).
- Tasks / plans without a `scheduledAt`, and any plan whose time is already in
  the past at capture, are **not** scheduled (just saved as today).

## Constraints / costs

- **Requires a native rebuild.** `expo-notifications` is a native module, so
  this needs `expo prebuild` + a Gradle rebuild (the same chain used for the
  existing dev build). There is no JS-only path to real scheduled local
  notifications. This is a one-time cost.
- Logic boundaries (`runTurn`, repositories, voice, backend) otherwise
  unchanged. No backend work.
- **No DB schema change** — the notification identifier is the plan id.

## Dependency

- `expo-notifications` (SDK 56-compatible version via `expo install`).
  Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before
  writing native-facing code (per app/AGENTS.md).

## Components

### `Notifier` service — `src/notify/notifier.ts`

Added to the `Services` container. Real implementation on device; a no-op
implementation used in tests and any non-device context.

```ts
export interface Notifier {
  schedule(plan: Plan): Promise<void>; // local notif at plan.scheduledAt
  cancel(planId: string): Promise<void>;
}
```

- **`schedule(plan)`**: schedules a local notification with
  `identifier = plan.id`, a date trigger at `plan.scheduledAt`, title =
  `plan.title`, body = persona-flavored one-liner (e.g. "From {persona}").
  Requests notification permission on first use; if permission is denied it
  resolves without scheduling (no throw).
- **`cancel(planId)`**: cancels the scheduled notification whose identifier is
  `planId` (no-op if none exists).
- **Init (module-level, once):** set the notification handler (how a
  notification presents while the app is foregrounded) and create the Android
  notification channel. Required for Android display.

Because the identifier is the plan id, cancel needs no stored mapping and no
schema change.

A `createNoopNotifier(): Notifier` factory (both methods resolve immediately) is
used by tests and the in-memory service wiring.

### `shouldSchedule` predicate — `src/notify/should-schedule.ts`

Pure function, unit-tested, single source of the "does this plan get a
notification?" decision:

```ts
export function shouldSchedule(plan: Plan, now: number): boolean;
// true  when plan.scheduledAt != null && plan.scheduledAt > now
// false for null scheduledAt (most tasks) and past times
```

Keeping it pure means the scheduling decision is testable without the native
module.

## Wiring

### Schedule on capture — `src/core/capture-service.ts`

`capturePlans` gains a `notifier: Notifier` in its deps. After each
`repo.add(plan)`:

```ts
if (shouldSchedule(plan, deps.now)) {
  await deps.notifier.schedule(plan);
}
```

`runTurn` (`src/app/turn.ts`) passes `deps.notifier` through to `capturePlans`.

### Cancel on completion — `src/screens/AgendaScreen.tsx`

The existing `markDone` handler also calls `notifier.cancel(plan.id)` before/after
`plans.markDone(id)`, so completing a plan stops its pending alert.

### No reschedule on boot

The OS persists scheduled local notifications across app restarts, so there is
no boot-time rescheduling logic. (A reinstall clears them — acceptable for v1.)

## Permission UX

Permission is requested lazily, inside `notifier.schedule`, the first time the
user sets a timed plan — contextual, not an upfront nag. If denied:

- The plan is still saved and appears in the Agenda.
- Scheduling silently no-ops.
- `ponytail:` no re-prompt loop; revisit if users get confused about missing
  alerts.

## Config — `app.json`

Add the `expo-notifications` config plugin (notification icon/color) and ensure
Android 13+ `POST_NOTIFICATIONS` permission is declared (the plugin handles
this). No other config changes.

## Data flow

Unchanged except for the two new calls (`schedule` after add, `cancel` on
mark-done). Plans remain the single source of truth in SQLite; notifications are
a derived side effect keyed by plan id.

## Error handling

- Permission denied → `schedule` resolves without scheduling (no throw); capture
  still succeeds.
- `schedule` / `cancel` failures are swallowed (best-effort side effect) so they
  never break capture or mark-done. `ponytail:` surface a toast only if it
  proves confusing in use.

## Testing

- **`shouldSchedule`** — unit test: future timed plan (true); past time (false);
  null `scheduledAt` (false); task type with no time (false).
- **`capturePlans`** — with a mock notifier: `schedule` called once for a
  future-timed captured plan; **not** called for a past-dated or timeless plan;
  cancel never called here.
- Existing `turn` and `ConversationScreen` tests: add a no-op notifier to their
  service/dep mocks so they keep compiling and passing.
- **Real `notifier.ts`** (native) is verified manually on the emulator after the
  rebuild: set a reminder ~1 min out, confirm it fires; mark a plan done, confirm
  its notification is cancelled; deny permission, confirm capture still works.

## Out of scope (deferred)

- Lead time for events ("10 min before").
- Recurring reminders ("every day at 9am").
- Notification action buttons (mark done / snooze) and background handling.
- Editing a plan's time (no edit UI exists yet → no reschedule path needed).
- Deep-linking the tap to a specific plan (v1 just opens the Agenda).

## File summary

- New: `src/notify/notifier.ts`, `src/notify/should-schedule.ts`,
  `src/notify/should-schedule.test.ts` (or under `__tests__/`).
- Edit: `src/app/services.tsx` (add `notifier` to `Services`),
  `src/app/build-services.ts` (wire real notifier),
  `src/core/capture-service.ts` (schedule after add),
  `src/app/turn.ts` (pass notifier through),
  `src/screens/AgendaScreen.tsx` (cancel on mark-done),
  `app.json` (expo-notifications plugin), and the `turn` /
  `ConversationScreen` test mocks.
- Untouched: backend, db schema, voice/speech, briefing, theme/UI primitives.
