import React, { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { G, Line, Circle, Text as SvgText } from "react-native-svg";
import { useServices } from "../app/services";
import { useGraphLayout } from "../ui/graph/use-graph-layout";
import type { Entity, EntityType } from "../core/types";
import { Screen } from "../ui/Screen";
import { colors, font, space } from "../ui/theme";

const NODE_COLOR: Record<EntityType, string> = {
  person: colors.accent,
  goal: colors.reminder,
  fact: colors.task,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function GraphScreen({ onSelect }: { onSelect: (entityId: string) => void }) {
  const { store } = useServices();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Array<[string, string]>>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    store.allEntities().then(setEntities);
    store.graphEdges().then(setEdges);
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

  if (entities.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Bram hasn't learned anything yet — talk to me.</Text>
        </View>
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
                  x1={na.x}
                  y1={na.y}
                  x2={nb.x}
                  y2={nb.y}
                  stroke={colors.hairline}
                  strokeWidth={1}
                />
              );
            })}
            {nodes.map((n) => (
              <React.Fragment key={n.id}>
                <Circle
                  cx={n.x ?? 0}
                  cy={n.y ?? 0}
                  r={clamp(8 + n.degree * 2, 8, 22)}
                  fill={NODE_COLOR[n.type]}
                  onPress={() => onSelect(n.id)}
                />
                <SvgText
                  x={n.x}
                  y={(n.y ?? 0) + clamp(8 + n.degree * 2, 8, 22) + 12}
                  fill={colors.muted}
                  fontSize={10}
                  textAnchor="middle"
                >
                  {n.name}
                </SvgText>
              </React.Fragment>
            ))}
          </G>
        </Svg>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.base },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyText: { color: colors.muted, fontSize: font.body, textAlign: "center", lineHeight: 22 },
});
