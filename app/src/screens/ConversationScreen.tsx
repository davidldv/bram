import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { runTurn } from "../app/turn";
import { getPersonaName } from "../core/persona";
import { Screen } from "../ui/Screen";
import { Orb, type OrbState } from "../ui/Orb";
import { Bubble } from "../ui/Bubble";
import { colors, font, radius, space } from "../ui/theme";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const STATUS: Record<OrbState, (name: string) => string> = {
  idle: (n) => `Tap to talk to ${n}`,
  listening: () => "Listening…",
  thinking: () => "Thinking…",
  speaking: (n) => `${n} is speaking…`,
};

const DOT: Record<OrbState, string> = {
  idle: colors.muted,
  listening: colors.accentCyan,
  thinking: colors.accent2,
  speaking: colors.accent,
};

export function ConversationScreen() {
  const s = useServices();
  const [messages, setMessages] = useState<Message[]>([]);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [persona, setPersona] = useState("Zayn");
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    getPersonaName(s.prefs).then(setPersona);
  }, [s]);

  const add = (m: Message) => setMessages((prev) => [...prev, m]);

  const onTalk = async () => {
    if (orb !== "idle") return;
    setOrb("listening");
    try {
      await s.voice.start(async (transcript) => {
        if (!transcript) {
          setOrb("idle");
          return;
        }
        add({ role: "user", text: transcript });
        setOrb("thinking");
        try {
          const result = await runTurn(
            { api: s.api, plans: s.plans, topics: s.topics, prefs: s.prefs, store: s.store, notifier: s.notifier, calendar: s.calendar, now: s.now(), newId: s.newId },
            transcript
          );
          add({ role: "assistant", text: result.text });
          setOrb("speaking");
          await s.speaker.speak(result.text);
        } catch {
          add({ role: "assistant", text: "Something went wrong reaching the server." });
        } finally {
          setOrb("idle");
        }
      });
    } catch {
      add({ role: "assistant", text: "Sorry, I couldn't hear you." });
      setOrb("idle");
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Bram</Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <Text style={styles.hello}>Hi, I'm {persona}.</Text>
            <Text style={styles.helloSub}>
              Your voice companion. Tap the orb and tell me anything — plans, people, or what's on your mind.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scroller}
            style={styles.log}
            contentContainerStyle={styles.logContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} />
            ))}
          </ScrollView>
        )}

        <View style={styles.stage}>
          <Orb state={orb} onPress={onTalk} disabled={orb !== "idle"} />
          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: DOT[orb] }]} />
            <Text style={styles.status}>{STATUS[orb](persona)}</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  wordmark: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: font.weight.bold,
    letterSpacing: 0.5,
  },
  welcome: { flex: 1, justifyContent: "center", paddingHorizontal: space.xl },
  hello: {
    color: colors.text,
    fontSize: font.hero,
    fontWeight: font.weight.bold,
    letterSpacing: -1,
    marginBottom: space.md,
  },
  helloSub: { color: colors.textDim, fontSize: font.title, lineHeight: 26, maxWidth: 320 },
  log: { flex: 1 },
  logContent: { padding: space.lg, justifyContent: "flex-end", flexGrow: 1 },
  stage: { alignItems: "center", paddingBottom: space.xl },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: space.sm },
  status: { color: colors.textDim, fontSize: font.body, fontWeight: font.weight.medium },
});
