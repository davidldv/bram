import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName } from "../core/persona";
import type { Plan, CalendarEvent } from "../core/types";
import { buildAgenda } from "../core/agenda";
import { dayRange } from "../core/briefing-service";
import { Screen } from "../ui/Screen";
import { Header } from "../ui/Header";
import { Section } from "../ui/Section";
import { PlanCard } from "../ui/PlanCard";
import { EventCard } from "../ui/EventCard";
import { EmptyState } from "../ui/EmptyState";
import type { PlanGroup } from "../ui/relative-time";
import { space } from "../ui/theme";

const GROUP_TITLE: Record<PlanGroup, string> = {
  today: "Today",
  upcoming: "Upcoming",
  someday: "Someday",
};

const HORIZON_DAYS = 14;

export function AgendaScreen() {
  const s = useServices();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [persona, setPersona] = useState("Zayn");
  const now = s.now();

  const refresh = useCallback(() => {
    s.plans.list().then(setPlans);
    const { startMs } = dayRange(now);
    s.calendar.listEvents(startMs, startMs + HORIZON_DAYS * 24 * 60 * 60 * 1000).then(setEvents);
  }, [s, now]);

  useEffect(() => {
    refresh();
    getPersonaName(s.prefs).then(setPersona);
  }, [s, refresh]);

  const toggle = async (id: string) => {
    await s.plans.markDone(id);
    await s.notifier.cancel(id);
    refresh();
  };

  const groups = buildAgenda(plans, events, now);
  const subtitle = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Screen>
      {groups.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="Your day is clear"
          text={`Nothing on your plate. Talk to ${persona} to add a reminder, task, or event.`}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Header title="Agenda" subtitle={subtitle} />
          {groups.map((g) => (
            <Section key={g.group} title={GROUP_TITLE[g.group]}>
              {g.items.map((it, i) =>
                it.kind === "plan" ? (
                  <PlanCard key={`p-${it.plan.id}`} plan={it.plan} now={now} onToggleDone={toggle} index={i} />
                ) : (
                  <EventCard key={`e-${it.event.id}`} event={it.event} now={now} index={i} />
                )
              )}
            </Section>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
});
