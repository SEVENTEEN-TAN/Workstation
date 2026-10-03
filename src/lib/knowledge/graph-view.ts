import type { KnowledgeGraph } from "./graph-contract";

export type GraphPoint = { x: number; y: number };
export const GRAPH_WIDTH = 960;
export const GRAPH_HEIGHT = 640;
export const GRAPH_COLORS = ["#00df8f", "#65b7ff", "#b79cff", "#f0bf6d", "#f18ca9", "#6dddd0"];

export function filterKnowledgeGraph(graph: KnowledgeGraph, query = "", category = ""): KnowledgeGraph {
  const term = query.trim().toLocaleLowerCase();
  const nodes = graph.nodes.filter((node) => (!category || node.category === category) && (!term || node.title.toLocaleLowerCase().includes(term)));
  const ids = new Set(nodes.map((node) => node.id));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

export function graphNeighbors(graph: KnowledgeGraph, id: string) {
  const outgoing = new Set<string>();
  const incoming = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === id) outgoing.add(edge.target);
    if (edge.target === id) incoming.add(edge.source);
  }
  return { outgoing, incoming, all: new Set([...outgoing, ...incoming]) };
}

export function clampGraphZoom(value: number) { return Math.min(4, Math.max(0.5, value)); }

export function layoutKnowledgeGraph(graph: KnowledgeGraph): Record<string, GraphPoint> {
  const nodes = graph.nodes.map((node, index) => {
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt((index + 0.5) / graph.nodes.length) * 300;
    return { id: node.id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, fx: 0, fy: 0 };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // ponytail: a bounded, deterministic layout for the contract's 2,000-node ceiling; no live physics loop.
  for (let step = 0; step < 100; step++) {
    const cells = new Map<string, typeof nodes>();
    for (const node of nodes) {
      node.fx = -node.x * 0.008; node.fy = -node.y * 0.008;
      const key = `${Math.floor(node.x / 70)},${Math.floor(node.y / 70)}`;
      const cell = cells.get(key) ?? []; cell.push(node); cells.set(key, cell);
    }
    for (const node of nodes) {
      const gx = Math.floor(node.x / 70), gy = Math.floor(node.y / 70);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (other === node) continue;
          const x = node.x - other.x, y = node.y - other.y, square = Math.max(x * x + y * y, 16);
          node.fx += x * 100 / square; node.fy += y * 100 / square;
        }
      }
    }
    for (const edge of graph.edges) {
      const source = byId.get(edge.source)!, target = byId.get(edge.target)!;
      const x = target.x - source.x, y = target.y - source.y;
      const force = (Math.hypot(x, y) - 42) * 0.018 / Math.max(Math.hypot(x, y), 1);
      source.fx += x * force; source.fy += y * force; target.fx -= x * force; target.fy -= y * force;
    }
    const cooling = 1 - step / 125;
    for (const node of nodes) { node.x += Math.max(-8, Math.min(8, node.fx)) * cooling; node.y += Math.max(-8, Math.min(8, node.fy)) * cooling; }
  }
  if (!nodes.length) return {};
  const minX = Math.min(...nodes.map((node) => node.x)), maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y)), maxY = Math.max(...nodes.map((node) => node.y));
  const scale = Math.min((GRAPH_WIDTH - 120) / Math.max(maxX - minX, 1), (GRAPH_HEIGHT - 120) / Math.max(maxY - minY, 1));
  return Object.fromEntries(nodes.map((node) => [node.id, { x: (node.x - (minX + maxX) / 2) * scale + GRAPH_WIDTH / 2, y: (node.y - (minY + maxY) / 2) * scale + GRAPH_HEIGHT / 2 }]));
}
