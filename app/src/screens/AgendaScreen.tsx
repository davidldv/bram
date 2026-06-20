import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName } from "../core/persona";
import type { Plan } from "../core/types";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { PlanCard } from "../ui/PlanCard";
import { planGroup, type PlanGroup } from "../ui/relative-time";
import { colors, font, space } from "../ui/theme";

const GROUP_TITLE: Record<PlanGroup, string> = {
  today: "Today",
  upcoming: "Upcoming",
  someday: "Someday",
};
const ORDER: PlanGroup[] = ["today", "upcoming", "someday"];

export function AgendaScreen() {
  const s = useServices();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [persona, setPersona] = useState("Zayn");
  const now = s.now();

  const refresh = useCallback(() => {
    s.plans.list().then(setPlans);
  }, [s]);

  useEffect(() => {
    refresh();
    getPersonaName(s.prefs).then(setPersona);
  }, [s, refresh]);

  const toggle = async (id: string) => {
    await s.plans.markDone(id);
    await s.notifier.cancel(id);
    refresh();
  };

  const buckets = ORDER.map((g) => ({
    group: g,
    items: plans
      .filter((p) => planGroup(now, p.scheduledAt) === g)
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity)),
  })).filter((b) => b.items.length > 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Agenda</Text>
        {buckets.length === 0 ? (
          <Text style={styles.empty}>Nothing on your plate. Talk to {persona} to add something.</Text>
        ) : (
          buckets.map((b) => (
            <Section key={b.group} title={GROUP_TITLE[b.group]}>
              {b.items.map((p) => (
                <PlanCard key={p.id} plan={p} now={now} onToggleDone={toggle} />
              ))}
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
