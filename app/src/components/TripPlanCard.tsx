import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, radius, spacing } from "../theme";

export interface TripStop {
  day: number;
  type: "place" | "food" | "cafe";
  name: string;
  note?: string;
  estCostINR?: number;
  imageQuery: string;
}

export interface TripPlan {
  destination: string;
  days: number;
  budgetINR?: number;
  summary: string;
  stops: TripStop[];
}

const TYPE_LABEL: Record<TripStop["type"], string> = {
  place: "place",
  food: "food",
  cafe: "cafe",
};
const TYPE_ICON: Record<TripStop["type"], string> = {
  place: "📍",
  food: "🍽️",
  cafe: "☕",
};

// Real photos, no API key: Wikimedia Commons (a dedicated photo repository —
// namespace 6 is file pages) is tried first since it has far better coverage
// of landmarks, dishes and cafes than a plain Wikipedia article thumbnail;
// a Wikipedia article thumbnail is the fallback. Both are free, CORS-open
// (origin=*). A gradient card is the last resort, not a broken image.
const imageCache = new Map<string, string | null>();

async function fetchCommonsImage(query: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data?.query?.pages;
  const first = pages ? (Object.values(pages)[0] as any) : null;
  return first?.imageinfo?.[0]?.thumburl ?? null;
}

async function fetchWikipediaImage(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data?.query?.pages;
  const first = pages ? (Object.values(pages)[0] as any) : null;
  return first?.thumbnail?.source ?? null;
}

function useWikiImage(query: string): string | null | "loading" {
  const [state, setState] = useState<string | null | "loading">(() => imageCache.get(query) ?? "loading");

  useEffect(() => {
    if (imageCache.has(query)) {
      setState(imageCache.get(query) ?? null);
      return;
    }
    let cancelled = false;
    (async () => {
      let src: string | null = null;
      try {
        src = await fetchCommonsImage(query);
      } catch {
        /* fall through to Wikipedia */
      }
      if (!src) {
        try {
          src = await fetchWikipediaImage(query);
        } catch {
          src = null;
        }
      }
      imageCache.set(query, src);
      if (!cancelled) setState(src);
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return state;
}

function StopCard({ stop }: { stop: TripStop }) {
  const image = useWikiImage(stop.imageQuery);

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {image === "loading" ? (
          <View style={[styles.image, styles.imagePlaceholder]} />
        ) : image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackIcon}>{TYPE_ICON[stop.type]}</Text>
          </View>
        )}
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>day {stop.day}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.typeLabel}>
          {TYPE_ICON[stop.type]} {TYPE_LABEL[stop.type]}
        </Text>
        <Text style={styles.name} numberOfLines={2} preserveCase>
          {stop.name}
        </Text>
        {stop.note ? (
          <Text style={styles.note} numberOfLines={3} preserveCase>
            {stop.note}
          </Text>
        ) : null}
        {stop.estCostINR ? <Text style={styles.cost}>~₹{stop.estCostINR.toLocaleString("en-IN")}</Text> : null}
      </View>
    </View>
  );
}

export function TripPlanCard({ plan }: { plan: TripPlan }) {
  const totalEst = plan.stops.reduce((n, s) => n + (s.estCostINR ?? 0), 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary} preserveCase>
        {plan.summary}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaChip}>{plan.destination}</Text>
        <Text style={styles.metaChip}>
          {plan.days} day{plan.days === 1 ? "" : "s"}
        </Text>
        {totalEst > 0 ? (
          <Text style={styles.metaChip}>
            ~₹{totalEst.toLocaleString("en-IN")}
            {plan.budgetINR ? ` / ₹${plan.budgetINR.toLocaleString("en-IN")}` : ""}
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={176}
      >
        {plan.stops.map((stop, i) => (
          <StopCard key={`${stop.day}-${stop.name}-${i}`} stop={stop} />
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 160;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing(2), gap: spacing(2) },
  summary: { color: colors.textPrimary, fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: "row", gap: spacing(1.5), flexWrap: "wrap" },
  metaChip: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    overflow: "hidden",
  },
  scrollContent: { gap: spacing(3), paddingRight: spacing(4), paddingVertical: spacing(1) },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageWrap: { position: "relative" },
  image: { width: CARD_WIDTH, height: 110 },
  imagePlaceholder: { backgroundColor: colors.surfaceAlt },
  imageFallback: { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  imageFallbackIcon: { fontSize: 28 },
  dayBadge: {
    position: "absolute",
    top: spacing(1.5),
    left: spacing(1.5),
    backgroundColor: "#0A0812CC",
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
  },
  dayBadgeText: { color: "#F5F3FF", fontSize: 9.5, fontWeight: "700" },
  body: { padding: spacing(2.5), gap: 3 },
  typeLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "600" },
  name: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 17 },
  note: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
  cost: { color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 2 },
});
