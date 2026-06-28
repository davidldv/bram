import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useServices } from "../app/services";
import { getPersonaName, setPersonaName } from "../core/persona";
import type { NewsTopic, Entity } from "../core/types";
import { Screen } from "../ui/Screen";
import { Header } from "../ui/Header";
import { Section } from "../ui/Section";
import { Card } from "../ui/Card";
import { GradientButton } from "../ui/GradientButton";
import { PressableScale } from "../ui/motion";
import { colors, font, radius, space } from "../ui/theme";
import { AuthFlow } from "../auth/AuthFlow";
import { account as defaultAccount, type Account } from "../auth/account";
import { backup as defaultBackup, type Backup } from "../sync/backup";

// account() throws when Supabase isn't configured; Settings must still render.
function safeDefaultAccount(): Account {
  try {
    return defaultAccount();
  } catch {
    return {
      signUp: async () => {
        throw new Error("Cloud sync is not configured");
      },
      signIn: async () => {
        throw new Error("Cloud sync is not configured");
      },
      signOut: async () => {},
      getAccount: async () => null,
      getUserKey: async () => null,
    };
  }
}

// backup() throws when Supabase isn't configured; Settings must still render.
function safeDefaultBackup(): Backup {
  try {
    return defaultBackup();
  } catch {
    return {
      backupNow: async () => ({ error: "Cloud sync is not configured" }),
      restoreNow: async () => ({ error: "Cloud sync is not configured" }),
      getStatus: async () => ({ lastBackupAt: null }),
    };
  }
}

export function SettingsScreen({
  account = safeDefaultAccount(),
  backup = safeDefaultBackup(),
}: { account?: Account; backup?: Backup } = {}) {
  const s = useServices();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [topics, setTopics] = useState<NewsTopic[]>([]);
  const [memories, setMemories] = useState<Entity[]>([]);
  const [acct, setAcct] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const refreshAccount = () => account.getAccount().then(setAcct).catch(() => setAcct(null));
  useEffect(() => {
    refreshAccount();
  }, []);

  useEffect(() => {
    if (acct) backup.getStatus().then((s) => setLastBackupAt(s.lastBackupAt)).catch(() => {});
  }, [acct]);

  const runBackup = async (opts?: { force?: boolean }) => {
    setBackupBusy(true);
    setBackupMsg("");
    setConflict(false);
    const res = await backup.backupNow(opts);
    setBackupBusy(false);
    if ("ok" in res) {
      setBackupMsg("Backed up ✓");
      setLastBackupAt((await backup.getStatus()).lastBackupAt);
    } else if ("conflict" in res) {
      setConflict(true);
    } else {
      setBackupMsg(res.error);
    }
  };

  const runRestore = async () => {
    setConfirmRestore(false);
    setBackupBusy(true);
    setBackupMsg("");
    const res = await backup.restoreNow();
    setBackupBusy(false);
    if ("ok" in res) setBackupMsg("Restored ✓ — restart Bram to finish loading your data");
    else if ("empty" in res) setBackupMsg("Nothing to restore yet");
    else setBackupMsg(res.error);
  };

  useEffect(() => {
    getPersonaName(s.prefs).then((n) => {
      setName(n);
      setSaved(n);
    });
    s.topics.list().then(setTopics);
    s.store.facts().then(setMemories);
  }, [s]);

  const save = async () => {
    await setPersonaName(s.prefs, name);
    setSaved(await getPersonaName(s.prefs));
  };

  const toggle = async (t: NewsTopic) => {
    await s.topics.setEnabled(t.id, !t.enabled);
    setTopics(await s.topics.list());
  };

  const forget = async (id: string) => {
    await s.store.deleteEntity(id);
    setMemories(await s.store.facts());
  };

  const dirty = name.trim() !== saved && name.trim() !== "";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="Settings" subtitle="Make Bram yours" />

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
            <GradientButton label="Save" onPress={save} disabled={!dirty} accessibilityLabel="Save" />
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
                  trackColor={{ true: colors.accent, false: colors.surfaceHi }}
                  thumbColor={colors.text}
                />
              </View>
            ))}
          </Card>
        </Section>

        <Section title="What Bram knows">
          <Card>
            {memories.length === 0 ? (
              <Text style={styles.empty}>Nothing yet. Say "remember that…" to teach me.</Text>
            ) : (
              memories.map((m, i) => (
                <View key={m.id} style={[styles.factRow, i > 0 && styles.divider]}>
                  <Text style={styles.factText}>{m.name}</Text>
                  <PressableScale
                    onPress={() => forget(m.id)}
                    hitSlop={12}
                    accessibilityLabel={`forget: ${m.name}`}
                    style={styles.forget}
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </PressableScale>
                </View>
              ))
            )}
          </Card>
        </Section>
        <Section title="Cloud backup & sync">
          <Card>
            {acct ? (
              <>
                <View style={styles.topicRow}>
                  <Text style={styles.factText}>{acct.email}</Text>
                  <PressableScale
                    onPress={async () => { await account.signOut(); refreshAccount(); }}
                    accessibilityLabel="Sign out"
                    hitSlop={12}
                    style={styles.forget}
                  >
                    <Ionicons name="log-out-outline" size={18} color={colors.muted} />
                  </PressableScale>
                </View>
                <Text style={styles.empty}>
                  {lastBackupAt ? `Last backed up: ${new Date(lastBackupAt).toLocaleString()}` : "No cloud backup yet"}
                </Text>
                {backupBusy ? <ActivityIndicator accessibilityLabel="working" color={colors.accent} style={{ marginVertical: space.md }} /> : null}
                {backupMsg ? <Text style={styles.empty}>{backupMsg}</Text> : null}
                {conflict ? (
                  <>
                    <Text style={styles.empty}>A newer backup exists on another device.</Text>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Restore first" onPress={() => setConfirmRestore(true)} accessibilityLabel="Restore first" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="danger" label="Overwrite" onPress={() => runBackup({ force: true })} accessibilityLabel="Overwrite" />
                  </>
                ) : confirmRestore ? (
                  <>
                    <Text style={styles.empty}>This replaces this device's data with your last backup.</Text>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Confirm restore" onPress={runRestore} accessibilityLabel="Confirm restore" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="ghost" label="Cancel" onPress={() => setConfirmRestore(false)} accessibilityLabel="Cancel restore" />
                  </>
                ) : (
                  <>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Back up now" onPress={() => runBackup()} disabled={backupBusy} accessibilityLabel="Back up now" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="ghost" label="Restore" onPress={() => setConfirmRestore(true)} accessibilityLabel="Restore" />
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.empty}>
                  Back up your data, end-to-end encrypted, and sync across devices. Premium.
                </Text>
                <View style={{ height: space.md }} />
                <GradientButton
                  label="Back up & sync"
                  onPress={() => setAuthOpen(true)}
                  accessibilityLabel="Back up and sync"
                />
              </>
            )}
          </Card>
        </Section>
      </ScrollView>
      <AuthFlow
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={() => {
          setAuthOpen(false);
          refreshAccount();
        }}
        account={account}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  label: { color: colors.muted, fontSize: font.small, marginBottom: space.sm, letterSpacing: 0.3 },
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
  topicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  topicLabel: { color: colors.text, fontSize: font.body },
  empty: { color: colors.muted, fontSize: font.body, lineHeight: 20 },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.md,
  },
  factText: { color: colors.text, fontSize: font.body, flex: 1, marginRight: space.md },
  forget: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHi,
  },
});
