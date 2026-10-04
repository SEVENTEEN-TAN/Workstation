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

export function focusKnowledgeGraph(graph: KnowledgeGraph, id: string): KnowledgeGraph {
  if (!graph.nodes.some((node) => node.id === id)) return { ...graph, nodes: [], edges: [] };
  const ids = graphNeighbors(graph, id).all;
  ids.add(id);
  return { ...graph, nodes: graph.nodes.filter((node) => ids.has(node.id)), edges: graph.edges.filter((edge) => (edge.source === id || edge.target === id) && ids.has(edge.source) && ids.has(edge.target)) };
}

export function layoutFocusedKnowledgeGraph(graph: KnowledgeGraph, id: string, width: number) {
  const points: Record<string, GraphPoint> = {};
  const labels: Record<string, { lines: string[]; width: number; height: number; offsetY: number }> = {};
  const height = Math.max(380, Math.min(GRAPH_HEIGHT, width * 0.8));
  const center = { x: width / 2, y: height / 2 };
  for (const node of graph.nodes) {
    const nodeWidth = Math.min(width - 48, 240);
    const lines: string[] = [];
    let line = "", units = 0;
    for (const character of node.title) {
      const size = character.charCodeAt(0) < 128 ? 0.6 : 1;
      if (line && units + size > nodeWidth / 14) { lines.push(line); line = ""; units = 0; }
      line += character; units += size;
    }
    lines.push(line);
    labels[node.id] = { lines, width: nodeWidth, height: lines.length * 21, offsetY: 30 };
  }
  if (labels[id]) points[id] = center;
  const neighbors = graph.nodes.filter((node) => node.id !== id).sort((a, b) => a.id.localeCompare(b.id));
  const spacing = Math.max(0, ...Object.values(labels).map((label) => Math.hypot(label.width, label.height))) + 40;
  // Keep crowded labels apart in graph coordinates; zoom and pan reach notes beyond the viewport.
  const radius = Math.max(Math.min(width, height) * 0.32, spacing, neighbors.length > 1 ? spacing / (2 * Math.sin(Math.PI / neighbors.length)) : 0);
  neighbors.forEach((node, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / neighbors.length;
    points[node.id] = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    if (points[node.id].y < center.y - 1 && points[node.id].y > labels[node.id].height + 24) labels[node.id].offsetY = 2 - labels[node.id].height;
  });
  return { points, labels, height };
}

export function clampGraphZoom(value: number) { return Math.min(4, Math.max(0.5, value)); }

export function zoomGraphAt(view: GraphPoint & { zoom: number }, factor: number, anchor: GraphPoint) {
  const zoom = clampGraphZoom(view.zoom * factor), ratio = zoom / view.zoom;
  return { zoom, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

export function graphWheelZoomFactor(deltaY: number, deltaMode: number, pageHeight: number) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  return Math.exp(-Math.max(-240, Math.min(240, pixels)) * 0.002);
}

export function layoutKnowledgeGraph(graph: KnowledgeGraph, width = GRAPH_WIDTH, height = GRAPH_HEIGHT): Record<string, GraphPoint> {
  const nodes = [...graph.nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((node) => {
    let seed = 2166136261;
    for (const character of node.id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random() * graph.nodes.length) * 12;
    return { id: node.id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, fx: 0, fy: 0 };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // ponytail: a bounded, deterministic layout for the contract's 2,000-node ceiling; no live physics loop.
  for (let step = 0; step < 100; step++) {
    const cells = new Map<string, typeof nodes>();
    for (const node of nodes) {
      node.fx = -node.x * 0.025; node.fy = -node.y * 0.025;
      const key = `${Math.floor(node.x / 160)},${Math.floor(node.y / 160)}`;
      const cell = cells.get(key) ?? []; cell.push(node); cells.set(key, cell);
    }
    for (const node of nodes) {
      const gx = Math.floor(node.x / 160), gy = Math.floor(node.y / 160);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (other === node) continue;
          const x = node.x - other.x, y = node.y - other.y, square = x * x + y * y;
          const falloff = Math.max(0, 1 - Math.sqrt(square) / 160);
          const force = 650 * falloff * falloff / (square + 100);
          node.fx += x * force; node.fy += y * force;
        }
      }
    }
    for (const edge of graph.edges) {
      const source = byId.get(edge.source)!, target = byId.get(edge.target)!;
      const x = target.x - source.x, y = target.y - source.y;
      const force = (Math.hypot(x, y) - 64) * 0.006 / Math.max(Math.hypot(x, y), 1);
      source.fx += x * force; source.fy += y * force; target.fx -= x * force; target.fy -= y * force;
    }
    const cooling = 1 - step / 125;
    for (const node of nodes) { node.x += Math.max(-8, Math.min(8, node.fx)) * cooling; node.y += Math.max(-8, Math.min(8, node.fy)) * cooling; }
  }
  if (!nodes.length) return {};
  const minX = Math.min(...nodes.map((node) => node.x)), maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y)), maxY = Math.max(...nodes.map((node) => node.y));
  const padding = Math.min(60, width / 14);
  const scale = Math.min((width - padding * 2) / Math.max(maxX - minX, 1), (height - padding * 2) / Math.max(maxY - minY, 1));
  return Object.fromEntries(nodes.map((node) => [node.id, { x: (node.x - (minX + maxX) / 2) * scale + width / 2, y: (node.y - (minY + maxY) / 2) * scale + height / 2 }]));
}
