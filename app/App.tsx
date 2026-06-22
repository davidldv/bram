import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ServicesProvider, type Services } from "./src/app/services";
import { buildServices } from "./src/app/build-services";
import { syncProactiveNotifications } from "./src/core/proactivity";
import { ConversationScreen } from "./src/screens/ConversationScreen";
import { AgendaScreen } from "./src/screens/AgendaScreen";
import { GraphScreen } from "./src/screens/GraphScreen";
import { NodeDetailScreen } from "./src/screens/NodeDetailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { Screen } from "./src/ui/Screen";
import { TabBar, type Tab } from "./src/ui/TabBar";
import { colors, font, space } from "./src/ui/theme";

export default function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [tab, setTab] = useState<Tab>("talk");
  const [graphSel, setGraphSel] = useState<string | null>(null);

  useEffect(() => {
    buildServices().then(setServices);
  }, []);

  // Proactively (re)schedule heads-ups for upcoming calendar events on open.
  useEffect(() => {
    if (services) {
      syncProactiveNotifications({
        calendar: services.calendar,
        notifier: services.notifier,
        now: Date.now(),
      }).catch(() => {});
    }
  }, [services]);

  if (!services) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Starting Bram…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <ServicesProvider services={services}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <View style={styles.body}>
          {tab === "talk" && <ConversationScreen />}
          {tab === "agenda" && <AgendaScreen />}
          {tab === "graph" &&
            (graphSel ? (
              <NodeDetailScreen entityId={graphSel} onBack={() => setGraphSel(null)} onNavigate={setGraphSel} />
            ) : (
              <GraphScreen onSelect={setGraphSel} />
            ))}
          {tab === "settings" && <SettingsScreen />}
        </View>
        <TabBar active={tab} onChange={setTab} />
      </View>
    </ServicesProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.muted, fontSize: font.body, marginTop: space.md },
});
