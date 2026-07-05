import React, { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, StyleSheet, LayoutChangeEvent, ActivityIndicator } from "react-native";
import Svg, { G, Line, Circle, Text as SvgText } from "react-native-svg";
import { useServices } from "../app/services";
import { useGraphLayout } from "../ui/graph/use-graph-layout";
import type { Entity, EntityType } from "../core/types";
import { Screen } from "../ui/Screen";
import { EmptyState } from "../ui/EmptyState";
import { colors, entityTier, font, radius, space } from "../ui/theme";

const LEGEND: { type: EntityType; label: string }[] = [
  { type: "person", label: "People" },
  { type: "goal", label: "Goals" },
  { type: "fact", label: "Facts" },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const radiusFor = (degree: number) => clamp(9 + degree * 2.2, 9, 24);

export function GraphScreen({ onSelect }: { onSelect: (entityId: string) => void }) {
  const { store } = useServices();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Array<[string, string]>>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([store.allEntities(), store.graphEdges()]).then(([ents, edgs]) => {
      setEntities(ents);
      setEdges(edgs);
      setLoading(false);
    });
  }, [store]);

  const { nodes } = useGraphLayout(entities, edges, size);
  const pos = new Map(nodes.map((n) => [n.id, n]));

  // Pan + pinch-zoom on the whole canvas. Taps (no movement) fall through to a
  // node's onPress. ponytail: pinch scales about the origin, not the focal
  // point — acceptable for a brain map; upgrade to gesture-handler if it grates.
  const t = useRef({ x: 0, y: 0, scale: 1 });
  const start = useRef({ x: 0, y: 0, scale: 1, dist: 0 });
  const [, force] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.hypot(g.dx, g.dy) > 4 || g.numberActiveTouches === 2,
      onPanResponderGrant: () => {
        start.current = { x: t.current.x, y: t.current.y, scale: t.current.scale, dist: 0 };
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          const d = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          if (start.current.dist === 0) start.current.dist = d;
          const ratio = start.current.dist > 0 ? d / start.current.dist : 1;
          t.current.scale = clamp(start.current.scale * ratio, 0.3, 3);
        } else {
          t.current.x = start.current.x + g.dx;
          t.current.y = start.current.y + g.dy;
        }
        force((n) => n + 1);
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textDim} />
        </View>
      </Screen>
    );
  }

  if (entities.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="git-network-outline"
          title="Your mind map is empty"
          text="As you talk, Bram maps the people, goals, and facts in your life. Start a conversation to grow it."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.canvas} onLayout={onLayout} {...pan.panHandlers}>
        <Svg width="100%" height="100%">
          <G transform={`translate(${t.current.x},${t.current.y}) scale(${t.current.scale})`}>
            {edges.map(([a, b], i) => {
              const na = pos.get(a);
              const nb = pos.get(b);
              if (!na || !nb) return null;
              return (
                <Line
                  key={i}
                  x1={na.x ?? 0}
                  y1={na.y ?? 0}
                  x2={nb.x ?? 0}
                  y2={nb.y ?? 0}
                  stroke="#FFFFFF"
                  strokeOpacity={0.12}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
            })}
            {nodes.map((n) => {
              const r = radiusFor(n.degree);
              return (
                <React.Fragment key={n.id}>
                  <Circle
                    cx={n.x ?? 0}
                    cy={n.y ?? 0}
                    r={r}
                    fill={entityTier[n.type]}
                    stroke={colors.hairlineStrong}
                    strokeWidth={1}
                    onPress={() => onSelect(n.id)}
                  />
                  <SvgText
                    x={n.x ?? 0}
                    y={(n.y ?? 0) + r + 14}
                    fill={colors.muted}
                    fontSize={10}
                    fontFamily={font.mono}
                    textAnchor="middle"
                  >
                    {n.name}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </G>
        </Svg>

        <View style={styles.legend} pointerEvents="none">
          {LEGEND.map((l) => (
            <View key={l.type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: entityTier[l.type] }]} />
              <Text style={styles.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  legend: {
    position: "absolute",
    top: space.md,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: space.xs + 2 },
  legendLabel: { color: colors.textDim, fontSize: font.small, fontWeight: font.weight.medium },
});
