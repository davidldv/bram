import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useServices } from "../app/services";
import type { Entity, EntityType, LifeEvent } from "../core/types";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Card } from "../ui/Card";
import { GradientButton } from "../ui/GradientButton";
import { PressableScale } from "../ui/motion";
import { colors, font, radius, space } from "../ui/theme";

const TYPE_COLOR: Record<EntityType, string> = {
  person: colors.accent,
  goal: colors.reminder,
  fact: colors.task,
};

export function NodeDetailScreen({
  entityId,
  onBack,
  onNavigate,
}: {
  entityId: string;
  onBack: () => void;
  onNavigate: (id: string) => void;
}) {
  const { store } = useServices();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [name, setName] = useState("");
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [neighbors, setNeighbors] = useState<Entity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const [all, evs, nbs] = await Promise.all([
        store.allEntities(),
        store.eventsForEntity(entityId),
        store.entityNeighbors(entityId),
      ]);
      if (!active) return;
      const e = all.find((x) => x.id === entityId) ?? null;
      setEntity(e);
      setName(e?.name ?? "");
      setEvents(evs);
      setNeighbors(nbs);
    })();
    return () => {
      active = false;
    };
  }, [store, entityId]);

  const save = async () => {
    if (!entity) return;
    setError("");
    try {
      const updated = await store.updateEntity(entity.id, name.trim(), entity.attributes);
      setEntity(updated);
    } catch {
      setError("That name is already taken.");
    }
  };

  const remove = () => {
    if (!entity) return;
    Alert.alert("Delete?", `Remove "${entity.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await store.deleteEntity(entity.id);
          onBack();
        },
      },
    ]);
  };

  const dirty = entity != null && name.trim() !== "" && name.trim() !== entity.name;
  const tint = entity ? TYPE_COLOR[entity.type] : colors.accent;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PressableScale onPress={onBack} hitSlop={12} accessibilityLabel="Back to graph" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={styles.back}>Graph</Text>
        </PressableScale>

        {!entity ? (
          <Text style={styles.empty}>Not found.</Text>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {entity.name}
              </Text>
              <View style={[styles.chip, { backgroundColor: tint + "22", borderColor: tint + "55" }]}>
                <Text style={[styles.chipText, { color: tint }]}>{entity.type}</Text>
              </View>
            </View>

            <Section title="Rename">
              <Card>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel="entity name"
                  style={styles.input}
                  placeholderTextColor={colors.muted}
                />
                {error !== "" && <Text style={styles.error}>{error}</Text>}
                <GradientButton label="Save" onPress={save} disabled={!dirty} accessibilityLabel="Save name" />
              </Card>
            </Section>

            <Section title="Events">
              <Card>
                {events.length === 0 ? (
                  <Text style={styles.empty}>No events yet.</Text>
                ) : (
                  events.map((ev, i) => (
                    <Text key={ev.id} style={[styles.row, i > 0 && styles.divider]}>
                      {ev.text}
                    </Text>
                  ))
                )}
              </Card>
            </Section>

            <Section title="Connected">
              <Card>
                {neighbors.length === 0 ? (
                  <Text style={styles.empty}>Nothing connected yet.</Text>
                ) : (
                  neighbors.map((nb, i) => (
                    <PressableScale
                      key={nb.id}
                      onPress={() => onNavigate(nb.id)}
                      style={[styles.linkRow, i > 0 && styles.divider]}
                      accessibilityLabel={`Open ${nb.name}`}
                    >
                      <Text style={styles.link}>{nb.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </PressableScale>
                  ))
                )}
              </Card>
            </Section>

            <GradientButton
              label="Delete"
              variant="danger"
              onPress={remove}
              accessibilityLabel="Delete entity"
              style={styles.delete}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: space.lg },
  back: { color: colors.accent, fontSize: font.body, fontWeight: font.weight.medium },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: space.xl },
  title: {
    color: colors.text,
    fontSize: font.display,
    fontWeight: font.weight.bold,
    letterSpacing: -0.5,
    flex: 1,
    marginRight: space.md,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chipText: { fontSize: font.small, fontWeight: font.weight.semibold, textTransform: "capitalize" },
  input: {
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  error: { color: colors.danger, fontSize: font.small, marginBottom: space.md },
  row: { color: colors.text, fontSize: font.body, paddingVertical: space.md, lineHeight: 20 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
  },
  link: { color: colors.accent, fontSize: font.body, fontWeight: font.weight.medium },
  empty: { color: colors.muted, fontSize: font.body },
  delete: { marginTop: space.lg },
});
