import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
} from "d3-force";
import type { Entity, EntityType } from "../../core/types";

export interface GraphNode {
  id: string;
  type: EntityType;
  name: string;
  degree: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

// Runs a d3-force simulation over the entities/edges, seeded on a circle so the
// first frame isn't a singularity. d3 ticks via requestAnimationFrame and stops
// itself once alpha decays (settle-then-freeze). We bump a counter each tick so
// React re-reads the mutated node positions.
export function useGraphLayout(
  entities: Entity[],
  edges: Array<[string, string]>,
  size: { width: number; height: number }
): { nodes: GraphNode[] } {
  const [, setTick] = useState(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);

  useEffect(() => {
    const degree = new Map<string, number>();
    for (const [a, b] of edges) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    const cx = size.width / 2;
    const cy = size.height / 2;
    const r = Math.max(40, Math.min(cx, cy) * 0.7);
    const nodes: GraphNode[] = entities.map((e, i) => {
      const angle = (i / Math.max(1, entities.length)) * 2 * Math.PI;
      return {
        id: e.id,
        type: e.type,
        name: e.name,
        degree: degree.get(e.id) ?? 0,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    nodesRef.current = nodes;
    const links: GraphLink[] = edges.map(([source, target]) => ({ source, target }));

    const sim = forceSimulation<GraphNode, GraphLink>(nodes)
      .force("charge", forceManyBody().strength(-140))
      .force("link", forceLink<GraphNode, GraphLink>(links).id((n) => n.id).distance(70))
      .force("center", forceCenter(cx, cy))
      .force("collide", forceCollide(24))
      .on("tick", () => setTick((t) => t + 1));
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [entities, edges, size.width, size.height]);

  return { nodes: nodesRef.current };
}
