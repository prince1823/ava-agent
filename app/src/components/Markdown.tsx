import React, { memo, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MarkdownDisplay from "react-native-markdown-display";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { colors, radius } from "../theme";
import { CheckIcon, CopyIcon } from "./Icons";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const text = code.replace(/\n$/, "");
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHead}>
        <Text style={styles.codeLang}>{language || "code"}</Text>
        <Pressable onPress={copy} style={styles.codeCopy} hitSlop={8}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          <Text style={[styles.codeCopyText, copied && { color: colors.accent }]}>{copied ? "Copied" : "Copy"}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText} selectable>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const rules = {
  fence: (node: any) => <CodeBlock key={node.key} code={node.content} language={node.sourceInfo} />,
  code_block: (node: any) => <CodeBlock key={node.key} code={node.content} />,
};

function MarkdownBase({ children }: { children: string }) {
  return (
    <MarkdownDisplay style={mdStyles as any} rules={rules as any} onLinkPress={(url) => {
      Linking.openURL(url).catch(() => {});
      return false;
    }}>
      {children}
    </MarkdownDisplay>
  );
}

export const Markdown = memo(MarkdownBase);

const mdStyles = StyleSheet.create({
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 23 },
  paragraph: { marginTop: 0, marginBottom: 10, flexWrap: "wrap" },
  strong: { fontWeight: "700", color: colors.textPrimary },
  em: { fontStyle: "italic" },
  s: { textDecorationLine: "line-through", color: colors.textSecondary },
  heading1: { fontSize: 22, fontWeight: "800", marginTop: 6, marginBottom: 8, color: colors.textPrimary },
  heading2: { fontSize: 19, fontWeight: "700", marginTop: 6, marginBottom: 6, color: colors.textPrimary },
  heading3: { fontSize: 16, fontWeight: "700", marginTop: 4, marginBottom: 4, color: colors.textPrimary },
  heading4: { fontSize: 15, fontWeight: "700", marginTop: 4, marginBottom: 4, color: colors.textPrimary },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4, flexDirection: "row" },
  bullet_list_icon: { color: colors.accent, marginRight: 8, marginLeft: 2, lineHeight: 23 },
  ordered_list_icon: { color: colors.accent, fontWeight: "700", marginRight: 8, marginLeft: 2, lineHeight: 23 },
  bullet_list_content: { flex: 1 },
  ordered_list_content: { flex: 1 },
  code_inline: {
    backgroundColor: colors.surfaceAlt,
    color: colors.accentGlow,
    fontFamily: MONO,
    fontSize: 13,
    borderRadius: 5,
    paddingHorizontal: 4,
  },
  blockquote: {
    backgroundColor: "#38E2A414",
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 6,
    borderRadius: 4,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
  link: { color: colors.accent, textDecorationLine: "underline" },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 8, overflow: "hidden" },
  thead: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontWeight: "700", borderRightWidth: 1, borderColor: colors.border },
  tr: { borderBottomWidth: 1, borderColor: colors.border, flexDirection: "row" },
  td: { padding: 8, borderRightWidth: 1, borderColor: colors.border },
});

const styles = StyleSheet.create({
  codeWrap: { backgroundColor: "#07100D", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginVertical: 8, overflow: "hidden" },
  codeHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderColor: colors.border },
  codeLang: { color: colors.textSecondary, fontSize: 11, fontFamily: MONO },
  codeCopy: { flexDirection: "row", alignItems: "center", gap: 5 },
  codeCopyText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  codeText: { color: "#E6FFF5", fontFamily: MONO, fontSize: 12.5, lineHeight: 19, padding: 12 },
});
