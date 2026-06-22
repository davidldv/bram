import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import type { Entity, LifeEvent } from "../core/types";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Card } from "../ui/Card";
import { colors, font, radius, space } from "../ui/theme";

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
      const all = await store.allEntities();
      const e = all.find((x) => x.id === entityId) ?? null;
      if (!active) return;
      setEntity(e);
      setName(e?.name ?? "");
      setEvents(await store.eventsForEntity(entityId));
      setNeighbors(await store.entityNeighbors(entityId));
    })();
    return () => {
      active = false;
    };
  }, [store, entityId]);

  const save = async () => {
    if (!entity) return;
    setError("");
    try {
      const updated = await store.updateEntity(entity.id, name, entity.attributes);
      setEntity(updated);
    } catch {
      setError("That name is already taken.");
    }
  };

  const remove = async () => {
    if (!entity) return;
    await store.deleteEntity(entity.id);
    onBack();
  };

  const dirty = entity != null && name.trim() !== "" && name.trim() !== entity.name;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back to graph">
          <Text style={styles.back}>‹ Graph</Text>
        </Pressable>

        {!entity ? (
          <Text style={styles.empty}>Not found.</Text>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{entity.name}</Text>
              <Text style={styles.chip}>{entity.type}</Text>
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
                <Pressable
                  onPress={save}
                  disabled={!dirty}
                  style={[styles.button, !dirty && styles.buttonOff]}
                  accessibilityLabel="Save name"
                >
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
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
                    <Pressable
                      key={nb.id}
                      onPress={() => onNavigate(nb.id)}
                      style={[styles.row, i > 0 && styles.divider]}
                      accessibilityLabel={`Open ${nb.name}`}
                    >
                      <Text style={styles.link}>{nb.name}</Text>
                    </Pressable>
                  ))
                )}
              </Card>
            </Section>

            <Pressable onPress={remove} style={styles.delete} accessibilityLabel="Delete entity">
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xl },
  back: { color: colors.accent, fontSize: font.body, marginBottom: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: space.xl },
  title: { color: colors.text, fontSize: font.display, fontWeight: font.weight.bold, flex: 1 },
  chip: {
    color: colors.muted,
    fontSize: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    overflow: "hidden",
  },
  input: {
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  error: { color: colors.reminder, fontSize: 12, marginBottom: space.md },
  button: { backgroundColor: colors.accent, borderRadius: radius.card, paddingVertical: space.md, alignItems: "center" },
  buttonOff: { backgroundColor: colors.hairline },
  buttonText: { color: colors.text, fontWeight: font.weight.semibold, fontSize: font.body },
  row: { color: colors.text, fontSize: font.body, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  link: { color: colors.accent, fontSize: font.body },
  empty: { color: colors.muted, fontSize: font.body },
  delete: { marginTop: space.xl, paddingVertical: space.md, alignItems: "center" },
  deleteText: { color: colors.reminder, fontSize: font.body, fontWeight: font.weight.semibold },
});
