import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName } from "../core/persona";
import type { Plan, CalendarEvent } from "../core/types";
import { buildAgenda } from "../core/agenda";
import { dayRange } from "../core/briefing-service";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { PlanCard } from "../ui/PlanCard";
import { EventCard } from "../ui/EventCard";
import type { PlanGroup } from "../ui/relative-time";
import { colors, font, space } from "../ui/theme";

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Agenda</Text>
        {groups.length === 0 ? (
          <Text style={styles.empty}>Nothing on your plate. Talk to {persona} to add something.</Text>
        ) : (
          groups.map((g) => (
            <Section key={g.group} title={GROUP_TITLE[g.group]}>
              {g.items.map((it) =>
                it.kind === "plan" ? (
                  <PlanCard key={`p-${it.plan.id}`} plan={it.plan} now={now} onToggleDone={toggle} />
                ) : (
                  <EventCard key={`e-${it.event.id}`} event={it.event} now={now} />
                )
              )}
            </Section>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xl },
  header: {
    color: colors.text,
    fontSize: font.display,
    fontWeight: font.weight.bold,
    marginBottom: space.xl,
  },
  empty: { color: colors.muted, fontSize: font.body, lineHeight: 22, marginTop: space.xl },
});
