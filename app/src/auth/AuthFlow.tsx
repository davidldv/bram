import React, { useState } from "react";
import { Modal, ScrollView, Text, TextInput, View, ActivityIndicator, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "../ui/Screen";
import { Card } from "../ui/Card";
import { Section } from "../ui/Section";
import { GradientButton } from "../ui/GradientButton";
import { PressableScale } from "../ui/motion";
import { colors, font, radius, space } from "../ui/theme";
import { account as defaultAccount, type Account } from "./account";

type Step = "login" | "signup" | "recovery" | "confirm";

export function AuthFlow({
  visible,
  onClose,
  onSignedIn,
  account = defaultAccount(),
}: {
  visible: boolean;
  onClose: () => void;
  onSignedIn: () => void;
  account?: Account;
}) {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doCopy = async () => {
    await Clipboard.setStringAsync(recoveryCode);
    setCopied(true);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const doSignUp = () =>
    run(async () => {
      const res = await account.signUp(email.trim(), password);
      setRecoveryCode(res.recoveryCode);
      setStep("recovery");
    });

  const doSignIn = () =>
    run(async () => {
      await account.signIn(email.trim(), password);
      onSignedIn();
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen ambient>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            {step === "signup" ? "Create your account" : step === "login" ? "Welcome back" : "Almost there"}
          </Text>

          {(step === "login" || step === "signup") && (
            <Section title={step === "signup" ? "Premium cloud backup" : "Sign in to sync"}>
              <Card>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="email"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="password"
                  placeholder="Master password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {busy ? <ActivityIndicator accessibilityLabel="working" color={colors.accent} style={styles.spinner} /> : null}
                {step === "login" ? (
                  <>
                    <GradientButton label={busy ? "Signing in…" : "Log in"} onPress={doSignIn} disabled={busy} accessibilityLabel="Log in" />
                    <PressableScale onPress={() => setStep("signup")} accessibilityLabel="Go to sign up" style={styles.linkBtn}>
                      <Text style={styles.link}>New here? Create an account</Text>
                    </PressableScale>
                  </>
                ) : (
                  <>
                    <Text style={styles.note}>
                      Your data is encrypted on this device first — we can never read it. That also means a lost
                      password can only be recovered with the recovery code on the next screen.
                    </Text>
                    <GradientButton label={busy ? "Creating account…" : "Create account"} onPress={doSignUp} disabled={busy} accessibilityLabel="Create account" />
                    <PressableScale onPress={() => setStep("login")} accessibilityLabel="Go to log in" style={styles.linkBtn}>
                      <Text style={styles.link}>Already have an account? Log in</Text>
                    </PressableScale>
                  </>
                )}
              </Card>
            </Section>
          )}

          {step === "recovery" && (
            <Section title="Your recovery code">
              <Card>
                <Text style={styles.note}>
                  Save this somewhere safe. It is the only way to recover your encrypted data if you forget your
                  password. We don't store it and can't show it again.
                </Text>
                <Text style={styles.code} accessibilityLabel="recovery code">{recoveryCode}</Text>
                <GradientButton
                  variant="ghost"
                  label={copied ? "Copied ✓" : "Copy"}
                  onPress={doCopy}
                  accessibilityLabel="Copy recovery code"
                />
                <View style={{ height: space.md }} />
                <PressableScale
                  onPress={() => setSaved((v) => !v)}
                  accessibilityLabel="I saved my recovery code"
                  style={styles.ack}
                >
                  <Text style={styles.link}>{saved ? "☑" : "☐"} I've saved my recovery code</Text>
                </PressableScale>
                <GradientButton
                  label="Continue"
                  onPress={() => setStep("confirm")}
                  disabled={!saved}
                  accessibilityLabel="Continue"
                />
              </Card>
            </Section>
          )}

          {step === "confirm" && (
            <Section title="Confirm your email">
              <Card>
                <Text style={styles.note}>
                  Please check your email and confirm your address, then come back and log in.
                </Text>
                <GradientButton label="Back to log in" onPress={() => setStep("login")} accessibilityLabel="Back to log in" />
              </Card>
            </Section>
          )}

          <PressableScale onPress={onClose} accessibilityLabel="Close" style={styles.linkBtn}>
            <Text style={styles.link}>Close</Text>
          </PressableScale>
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  title: { color: colors.text, fontSize: font.hero, fontWeight: font.weight.bold, letterSpacing: -1, marginBottom: space.lg },
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
  note: { color: colors.muted, fontSize: font.small, lineHeight: 18, marginBottom: space.md },
  error: { color: colors.danger, fontSize: font.small, marginBottom: space.md },
  spinner: { marginBottom: space.md },
  code: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: font.weight.bold,
    letterSpacing: 1,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.md,
  },
  ack: { paddingVertical: space.sm, marginBottom: space.md },
  linkBtn: { paddingVertical: space.md, alignItems: "center" },
  link: { color: colors.accent, fontSize: font.body },
});
