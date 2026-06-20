// Pure date helpers for the Agenda screen. No deps; locale-independent output
// so labels are stable across devices and testable.

function timeLabel(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRelative(now: number, scheduledAt: number | null): string {
  if (scheduledAt == null) return "Someday";
  const n = new Date(now);
  const d = new Date(scheduledAt);
  if (sameDay(n, d)) return `Today ${timeLabel(d)}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(n.getDate() + 1);
  if (sameDay(tomorrow, d)) return `Tomorrow ${timeLabel(d)}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${timeLabel(d)}`;
}

export type PlanGroup = "today" | "upcoming" | "someday";

export function planGroup(now: number, scheduledAt: number | null): PlanGroup {
  if (scheduledAt == null) return "someday";
  if (sameDay(new Date(now), new Date(scheduledAt))) return "today";
  // ponytail: past-dated (overdue) plans fall into "upcoming"; add an "overdue"
  // bucket if it matters in use.
  return "upcoming";
}
