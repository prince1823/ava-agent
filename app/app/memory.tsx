import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { AvaMark } from "../src/components/AvaLogo";
import { BackgroundArt } from "../src/components/BackgroundArt";
import { colors, radius, spacing } from "../src/theme";
import { loadProfile, refreshProfile, resetProfile, saveProfile, type UserProfile } from "../src/memory/profile";

type Tab = "cards" | "json";
type ListKey = "preferences" | "dietary_and_health" | "routines" | "interests" | "goals" | "recurring_requests" | "behavior_patterns";

const LIST_SECTIONS: Array<{ key: ListKey; icon: string; title: string }> = [
  { key: "preferences", icon: "⭐", title: "Preferences" },
  { key: "dietary_and_health", icon: "🥗", title: "Diet & health" },
  { key: "routines", icon: "🔁", title: "Routines" },
  { key: "interests", icon: "🎯", title: "Interests" },
  { key: "goals", icon: "🏁", title: "Goals" },
  { key: "recurring_requests", icon: "💬", title: "Often asks Ava to" },
  { key: "behavior_patterns", icon: "📈", title: "Patterns Ava noticed" },
];

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function countFacts(p: UserProfile): number {
  const about = [p.about.name, p.about.location, p.about.occupation, p.about.education].filter(Boolean).length + p.about.languages.length;
  const lists = LIST_SECTIONS.reduce((n, s) => n + p[s.key].length, 0);
  return about + lists + p.people.length + (p.communication_style ? 1 : 0);
}

export default function MemoryScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>("cards");
  const [busy, setBusy] = useState<null | "update" | "rebuild">(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => setProfile(loadProfile()), []);
  useFocusEffect(
    useCallback(() => {
      reload();
      // Catch up on any chats written since the last run.
      refreshProfile()
        .then((r) => r.status === "updated" && setProfile(r.profile))
        .catch(() => {});
    }, [reload])
  );

  const run = async (kind: "update" | "rebuild") => {
    setBusy(kind);
    setNote(null);
    try {
      const r = await refreshProfile({ rebuild: kind === "rebuild" });
      if (r.status === "updated") {
        setProfile(r.profile);
        setNote(`Read ${r.analyzed} messages.`);
      } else if (r.status === "up_to_date") {
        setNote("Already up to date.");
      } else {
        setNote("No chats yet. Talk to Ava first, then come back.");
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't update memory.");
    } finally {
      setBusy(null);
    }
  };

  const forgetAll = () =>
    Alert.alert("Forget everything?", "Ava will clear this profile. Your chats stay, and it can learn again from new messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Forget",
        style: "destructive",
        onPress: () => {
          resetProfile();
          setProfile(null);
          setNote(null);
        },
      },
    ]);

  const mutate = (fn: (p: UserProfile) => void) => {
    if (!profile) return;
    const next: UserProfile = JSON.parse(JSON.stringify(profile));
    fn(next);
    saveProfile(next);
    setProfile(next);
  };

  const total = profile ? countFacts(profile) : 0;

  return (
    <View style={styles.root}>
      <BackgroundArt />
      <Stack.Screen options={{ title: "Memory" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AvaMark size={44} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>What Ava knows about you</Text>
            <Text style={styles.heroSub}>
              {profile
                ? `${total} thing${total === 1 ? "" : "s"} · updated ${relativeTime(profile.updated_at)}`
                : "Nothing learned yet"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => run("update")} disabled={!!busy}>
            {busy === "update" ? <ActivityIndicator color="#0A1612" /> : <Text style={styles.primaryText}>Update memory</Text>}
          </Pressable>
          <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={() => run("rebuild")} disabled={!!busy}>
            {busy === "rebuild" ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.secondaryText}>Rebuild</Text>}
          </Pressable>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.segment}>
          {(["cards", "json"] as Tab[]).map((t) => (
            <Pressable key={t} style={[styles.segmentItem, tab === t && styles.segmentActive]} onPress={() => setTab(t)}>
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>{t === "cards" ? "Cards" : "JSON"}</Text>
            </Pressable>
          ))}
        </View>

        {!profile ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>Ava hasn't learned about you yet</Text>
            <Text style={styles.emptyBody}>
              Chat for a bit, say things like where you live or what you like, then tap Update memory. Ava keeps only what you actually say.
            </Text>
          </View>
        ) : tab === "cards" ? (
          <CardsView profile={profile} mutate={mutate} />
        ) : (
          <JsonView profile={profile} />
        )}

        {profile ? (
          <Pressable onPress={forgetAll} style={styles.forget}>
            <Text style={styles.forgetText}>Forget everything</Text>
          </Pressable>
        ) : null}
        <Text style={styles.footnote}>Built from your chats on this device. Tap ✕ on anything to make Ava forget it.</Text>
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Chip({ text, onForget }: { text: string; onForget: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
      <Pressable onPress={onForget} hitSlop={8}>
        <Text style={styles.chipX}>✕</Text>
      </Pressable>
    </View>
  );
}

function CardsView({ profile, mutate }: { profile: UserProfile; mutate: (fn: (p: UserProfile) => void) => void }) {
  const aboutRows: Array<[string, string]> = [];
  if (profile.about.name) aboutRows.push(["Name", profile.about.name]);
  if (profile.about.location) aboutRows.push(["Location", profile.about.location]);
  if (profile.about.occupation) aboutRows.push(["Work", profile.about.occupation]);
  if (profile.about.education) aboutRows.push(["Education", profile.about.education]);
  if (profile.about.languages.length) aboutRows.push(["Languages", profile.about.languages.join(", ")]);

  const sections = LIST_SECTIONS.filter((s) => profile[s.key].length > 0);
  const anything = aboutRows.length || sections.length || profile.people.length || profile.communication_style;

  if (!anything) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nothing stored yet</Text>
        <Text style={styles.emptyBody}>Ava read your chats but found no personal facts worth keeping.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {aboutRows.length > 0 && (
        <Section icon="👤" title="About you">
          {aboutRows.map(([k, v]) => (
            <View key={k} style={styles.kv}>
              <Text style={styles.kvKey}>{k}</Text>
              <Text style={styles.kvVal}>{v}</Text>
            </View>
          ))}
        </Section>
      )}

      {profile.communication_style ? (
        <Section icon="🗣️" title="How you talk">
          <Text style={styles.body}>{profile.communication_style}</Text>
        </Section>
      ) : null}

      {profile.people.length > 0 && (
        <Section icon="👥" title="People">
          {profile.people.map((p, i) => (
            <View key={`${p.name}-${i}`} style={styles.person}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.personBody}>
                <Text style={styles.personName}>{p.name}</Text>
                {(p.relationship || p.note) && (
                  <Text style={styles.personSub}>{[p.relationship, p.note].filter(Boolean).join(" · ")}</Text>
                )}
              </View>
              <Pressable onPress={() => mutate((n) => n.people.splice(i, 1))} hitSlop={8}>
                <Text style={styles.chipX}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      )}

      {sections.map((s) => (
        <Section key={s.key} icon={s.icon} title={s.title}>
          <View style={styles.chips}>
            {profile[s.key].map((item, i) => (
              <Chip key={`${item}-${i}`} text={item} onForget={() => mutate((n) => n[s.key].splice(i, 1))} />
            ))}
          </View>
        </Section>
      ))}
    </View>
  );
}

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

function JsonLine({ line }: { line: string }) {
  const m = line.match(/^(\s*)(?:("(?:[^"\\]|\\.)*")(\s*:\s*))?(.*?)(,?)$/);
  if (!m) return <Text style={styles.jsonDefault}>{line}</Text>;
  const [, indent, key, colon, value, comma] = m;
  let valueStyle = styles.jsonPunct;
  if (value.startsWith('"')) valueStyle = styles.jsonString;
  else if (/^-?\d/.test(value)) valueStyle = styles.jsonNumber;
  else if (/^(true|false|null)$/.test(value)) valueStyle = styles.jsonKeyword;
  return (
    <Text style={styles.jsonLine}>
      {indent}
      {key ? <Text style={styles.jsonKey}>{key}</Text> : null}
      {colon ? <Text style={styles.jsonPunct}>{colon}</Text> : null}
      <Text style={valueStyle}>{value}</Text>
      <Text style={styles.jsonPunct}>{comma}</Text>
    </Text>
  );
}

function JsonView({ profile }: { profile: UserProfile }) {
  const text = JSON.stringify(profile, null, 2);
  return (
    <View style={styles.jsonCard}>
      <View style={styles.jsonHead}>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: "#FF6B81" }]} />
          <View style={[styles.dot, { backgroundColor: "#F5C56B" }]} />
          <View style={[styles.dot, { backgroundColor: "#B9A6FF" }]} />
        </View>
        <Text style={styles.jsonTitle}>ava-memory.json</Text>
        <Pressable onPress={() => Share.share({ message: text })} hitSlop={8}>
          <Text style={styles.jsonShare}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.jsonBody}>
        {text.split("\n").map((l, i) => (
          <JsonLine key={i} line={l} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(3) },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(2) },
  heroText: { flex: 1 },
  heroTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
  heroSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing(2) },
  primary: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: spacing(3), alignItems: "center", justifyContent: "center", minHeight: 46 },
  primaryText: { color: "#0A1612", fontWeight: "800", fontSize: 14 },
  secondary: { paddingHorizontal: spacing(5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated, minHeight: 46 },
  secondaryText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.6 },
  note: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.bgElevated, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, paddingVertical: spacing(2), alignItems: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  segmentTextActive: { color: colors.accent },
  stack: { gap: spacing(3) },
  card: { backgroundColor: colors.bgElevated + "E6", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing(4), gap: spacing(3) },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  cardIcon: { fontSize: 16 },
  cardTitle: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  body: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  kv: { flexDirection: "row", gap: spacing(3) },
  kvKey: { color: colors.textSecondary, fontSize: 13, width: 82 },
  kvVal: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing(2), backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 7, paddingLeft: spacing(3), paddingRight: spacing(2.5), borderWidth: 1, borderColor: "#B9A6FF33", maxWidth: "100%" },
  chipText: { color: colors.textPrimary, fontSize: 13, flexShrink: 1 },
  chipX: { color: colors.textFaint, fontSize: 12 },
  person: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#B9A6FF55" },
  avatarText: { color: colors.accent, fontWeight: "800" },
  personBody: { flex: 1 },
  personName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  personSub: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  empty: { alignItems: "center", paddingVertical: spacing(10), paddingHorizontal: spacing(4), gap: spacing(2) },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  forget: { alignSelf: "center", paddingVertical: spacing(2), marginTop: spacing(2) },
  forgetText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  footnote: { color: colors.textFaint, fontSize: 11, textAlign: "center", lineHeight: 16 },
  jsonCard: { backgroundColor: "#07100D", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  jsonHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated },
  dots: { flexDirection: "row", gap: 6, width: 52 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  jsonTitle: { color: colors.textSecondary, fontSize: 12, fontFamily: MONO },
  jsonShare: { color: colors.accent, fontSize: 12, fontWeight: "700", width: 52, textAlign: "right" },
  jsonBody: { padding: spacing(3.5) },
  jsonLine: { fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  jsonDefault: { fontFamily: MONO, fontSize: 12, color: colors.textPrimary },
  jsonKey: { color: "#C4B5FD" },
  jsonString: { color: "#F2FFF9" },
  jsonNumber: { color: "#F5C56B" },
  jsonKeyword: { color: "#B79CFF" },
  jsonPunct: { color: "#5B7A6E" },
});
