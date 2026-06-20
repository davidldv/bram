import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Switch, Pressable, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName, setPersonaName } from "../core/persona";
import type { NewsTopic } from "../core/types";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Card } from "../ui/Card";
import { colors, font, radius, space } from "../ui/theme";

export function SettingsScreen() {
  const s = useServices();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [topics, setTopics] = useState<NewsTopic[]>([]);

  useEffect(() => {
    getPersonaName(s.prefs).then((n) => {
      setName(n);
      setSaved(n);
    });
    s.topics.list().then(setTopics);
  }, [s]);

  const save = async () => {
    await setPersonaName(s.prefs, name);
    setSaved(await getPersonaName(s.prefs));
  };

  const toggle = async (t: NewsTopic) => {
    await s.topics.setEnabled(t.id, !t.enabled);
    setTopics(await s.topics.list());
  };

  const dirty = name.trim() !== saved && name.trim() !== "";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Settings</Text>

        <Section title="Assistant">
          <Card>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel="persona name"
              placeholder="Zayn"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Pressable
              onPress={save}
              disabled={!dirty}
              style={[styles.button, !dirty && styles.buttonOff]}
              accessibilityLabel="Save"
            >
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
          </Card>
        </Section>

        <Section title="News topics">
          <Card>
            {topics.map((t, i) => (
              <View key={t.id} style={[styles.topicRow, i > 0 && styles.divider]}>
                <Text style={styles.topicLabel}>{t.label}</Text>
                <Switch
                  value={t.enabled}
                  onValueChange={() => toggle(t)}
                  accessibilityLabel={`toggle ${t.label}`}
                  trackColor={{ true: colors.accent, false: colors.hairline }}
                  thumbColor={colors.text}
                />
              </View>
            ))}
          </Card>
        </Section>
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
  label: { color: colors.muted, fontSize: 12, marginBottom: space.sm },
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    paddingVertical: space.md,
    alignItems: "center",
  },
  buttonOff: { backgroundColor: colors.hairline },
  buttonText: { color: colors.text, fontWeight: font.weight.semibold, fontSize: font.body },
  topicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  topicLabel: { color: colors.text, fontSize: font.body },
});
