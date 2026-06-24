import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { Orb } from "./src/ui/Orb";
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

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!services ? (
        <Screen ambient>
          <View style={styles.loading}>
            <Orb state="thinking" onPress={() => {}} disabled />
            <Text style={styles.brand}>Bram</Text>
            <Text style={styles.loadingText}>Waking up…</Text>
          </View>
        </Screen>
      ) : (
        <ServicesProvider services={services}>
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
            <TabBar
              active={tab}
              onChange={(t) => {
                if (t !== "graph") setGraphSel(null);
                setTab(t);
              }}
            />
          </View>
        </ServicesProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: {
    color: colors.text,
    fontSize: font.hero,
    fontWeight: font.weight.bold,
    letterSpacing: -1,
    marginTop: space.md,
  },
  loadingText: { color: colors.muted, fontSize: font.body, marginTop: space.sm },
});
