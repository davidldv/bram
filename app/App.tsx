import React, { useEffect, useState } from "react";
import { View, Text, Button, SafeAreaView, ActivityIndicator } from "react-native";
import { ServicesProvider, type Services } from "./src/app/services";
import { buildServices } from "./src/app/build-services";
import { ConversationScreen } from "./src/screens/ConversationScreen";
import { TopicsScreen } from "./src/screens/TopicsScreen";
import { PersonaScreen } from "./src/screens/PersonaScreen";

type Tab = "talk" | "topics" | "name";

export default function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [tab, setTab] = useState<Tab>("talk");

  useEffect(() => {
    buildServices().then(setServices);
  }, []);

  if (!services) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text>Starting Bram…</Text>
      </SafeAreaView>
    );
  }

  return (
    <ServicesProvider services={services}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === "talk" && <ConversationScreen />}
          {tab === "topics" && <TopicsScreen />}
          {tab === "name" && <PersonaScreen />}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 8 }}>
          <Button title="Talk" onPress={() => setTab("talk")} />
          <Button title="Topics" onPress={() => setTab("topics")} />
          <Button title="Name" onPress={() => setTab("name")} />
        </View>
      </SafeAreaView>
    </ServicesProvider>
  );
}
