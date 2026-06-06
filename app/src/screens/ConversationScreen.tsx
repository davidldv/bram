import React, { useState } from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { useServices } from "../app/services";
import { runTurn } from "../app/turn";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ConversationScreen() {
  const s = useServices();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const onTalk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await s.voice.start(async (transcript) => {
        if (!transcript) {
          setBusy(false);
          return;
        }
        setMessages((m) => [...m, { role: "user", text: transcript }]);
        try {
          const result = await runTurn(
            { api: s.api, plans: s.plans, topics: s.topics, prefs: s.prefs, now: s.now(), newId: s.newId },
            transcript
          );
          setMessages((m) => [...m, { role: "assistant", text: result.text }]);
          await s.speaker.speak(result.text);
        } catch {
          setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching the server." }]);
        } finally {
          setBusy(false);
        }
      });
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't hear you." }]);
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <ScrollView style={{ flex: 1 }}>
        {messages.map((m, i) => (
          <Text key={i} style={{ marginVertical: 4 }}>
            {m.role === "user" ? "You: " : ""}
            {m.text}
          </Text>
        ))}
      </ScrollView>
      <Button title={busy ? "Listening…" : "Talk"} onPress={onTalk} disabled={busy} />
    </View>
  );
}
