import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import { runTurn } from "../app/turn";
import { getPersonaName } from "../core/persona";
import { Screen } from "../ui/Screen";
import { Orb, type OrbState } from "../ui/Orb";
import { Bubble } from "../ui/Bubble";
import { colors, font, space } from "../ui/theme";

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
            { api: s.api, plans: s.plans, topics: s.topics, prefs: s.prefs, now: s.now(), newId: s.newId },
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
    <Screen ambient>
      <View style={styles.root}>
        <ScrollView
          ref={scroller}
          style={styles.log}
          contentContainerStyle={styles.logContent}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
        </ScrollView>
        <View style={styles.stage}>
          <Orb state={orb} onPress={onTalk} disabled={orb !== "idle"} />
          <Text style={styles.status}>{STATUS[orb](persona)}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  log: { flex: 1 },
  logContent: { padding: space.lg, justifyContent: "flex-end", flexGrow: 1 },
  stage: { alignItems: "center", paddingBottom: space.xl },
  status: { color: colors.muted, fontSize: font.body, marginTop: space.sm },
});
