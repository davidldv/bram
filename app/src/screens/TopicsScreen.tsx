import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { useServices } from "../app/services";
import type { NewsTopic } from "../core/types";

export function TopicsScreen() {
  const s = useServices();
  const [topics, setTopics] = useState<NewsTopic[]>([]);

  useEffect(() => {
    s.topics.list().then(setTopics);
  }, [s]);

  const toggle = async (t: NewsTopic) => {
    await s.topics.setEnabled(t.id, !t.enabled);
    setTopics(await s.topics.list());
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>News topics</Text>
      {topics.map((t) => (
        <View
          key={t.id}
          style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}
        >
          <Text>{t.label}</Text>
          <Switch
            value={t.enabled}
            onValueChange={() => toggle(t)}
            accessibilityLabel={`toggle ${t.label}`}
          />
        </View>
      ))}
    </View>
  );
}
