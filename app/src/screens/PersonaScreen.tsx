import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName, setPersonaName } from "../core/persona";

export function PersonaScreen() {
  const s = useServices();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    getPersonaName(s.prefs).then((n) => {
      setName(n);
      setSaved(n);
    });
  }, [s]);

  const save = async () => {
    await setPersonaName(s.prefs, name);
    setSaved(await getPersonaName(s.prefs));
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Assistant name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        accessibilityLabel="persona name"
        style={{ borderWidth: 1, padding: 8, marginBottom: 12 }}
      />
      <Button title="Save" onPress={save} />
      <Text style={{ marginTop: 12 }}>Current: {saved}</Text>
    </View>
  );
}
