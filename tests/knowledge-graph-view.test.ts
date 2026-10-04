import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeGraphView } from "../src/components/knowledge/KnowledgeGraphView";
import type { KnowledgeGraph } from "../src/lib/knowledge/graph-contract";
import { clampGraphZoom, filterKnowledgeGraph, focusKnowledgeGraph, graphNeighbors, graphWheelZoomFactor, layoutFocusedKnowledgeGraph, layoutKnowledgeGraph, zoomGraphAt } from "../src/lib/knowledge/graph-view";

const graph: KnowledgeGraph = { version: 1, generatedAt: "2026-10-03T00:00:00.000Z", nodes: [
  { id: "a", title: "Java Basics", category: "Java" }, { id: "b", title: "Java Memory", category: "Java" }, { id: "c", title: "Model", category: "AI" },
], edges: [{ source: "a", target: "b" }, { source: "b", target: "a" }, { source: "c", target: "a" }] };

describe("knowledge graph browsing", () => {
  it("defers floating-point layout until hydration to avoid server/browser coordinate mismatches", () => {
    const html = renderToStaticMarkup(createElement(KnowledgeGraphView, { graph }));
    expect(html).toContain("正在载入知识图谱");
    expect(html).not.toContain("<svg");
  });
  it("filters case-insensitive titles and categories without retaining dangling links", () => {
    expect(filterKnowledgeGraph(graph, " JAVA ", "Java")).toMatchObject({ nodes: graph.nodes.slice(0, 2), edges: graph.edges.slice(0, 2) });
    expect(filterKnowledgeGraph(graph, "none")).toMatchObject({ nodes: [], edges: [] });
  });
  it("distinguishes incoming and outgoing references and deduplicates neighbors", () => {
    const neighbors = graphNeighbors(graph, "a");
    expect([...neighbors.outgoing]).toEqual(["b"]);
    expect([...neighbors.incoming]).toEqual(["b", "c"]);
    expect([...neighbors.all]).toEqual(["b", "c"]);
  });
  it("lays out deterministically within the viewport, including empty and single-note graphs", () => {
    const positions = layoutKnowledgeGraph(graph);
    expect(layoutKnowledgeGraph(graph)).toEqual(positions);
    expect(new Set(Object.values(positions).map((point) => `${point.x},${point.y}`)).size).toBe(3);
    for (const point of Object.values(positions)) { expect(point.x).toBeGreaterThanOrEqual(60); expect(point.x).toBeLessThanOrEqual(900); expect(point.y).toBeGreaterThanOrEqual(60); expect(point.y).toBeLessThanOrEqual(580); }
    expect(layoutKnowledgeGraph({ ...graph, nodes: [], edges: [] })).toEqual({});
    expect(layoutKnowledgeGraph({ ...graph, nodes: graph.nodes.slice(0, 1), edges: [] })).toEqual({ a: { x: 480, y: 320 } });
  });
  it("bounds zoom controls", () => { expect(clampGraphZoom(0.1)).toBe(0.5); expect(clampGraphZoom(6)).toBe(4); expect(clampGraphZoom(1.2)).toBe(1.2); });
  it("keeps the cursor's graph point fixed while zooming and at both limits", () => {
    const anchor = { x: 240, y: 180 };
    expect(zoomGraphAt({ zoom: 1, x: 40, y: 20 }, 2, anchor)).toEqual({ zoom: 2, x: -160, y: -140 });
    expect(zoomGraphAt({ zoom: 2, x: -160, y: -140 }, 0.5, anchor)).toEqual({ zoom: 1, x: 40, y: 20 });
    expect(zoomGraphAt({ zoom: 1, x: 0, y: 0 }, 100, anchor)).toEqual({ zoom: 4, x: -720, y: -540 });
    expect(zoomGraphAt({ zoom: 1, x: 0, y: 0 }, 0.001, anchor)).toEqual({ zoom: 0.5, x: 120, y: 90 });
    expect(zoomGraphAt({ zoom: 4, x: 12, y: 24 }, 2, anchor)).toEqual({ zoom: 4, x: 12, y: 24 });
  });
  it("normalizes wheel units, zooms in for up, and bounds extreme single events", () => {
    expect(graphWheelZoomFactor(-120, 0, 640)).toBeGreaterThan(1);
    expect(graphWheelZoomFactor(120, 0, 640)).toBeLessThan(1);
    expect(graphWheelZoomFactor(0, 0, 640)).toBe(1);
    expect(graphWheelZoomFactor(3, 1, 640)).toBeCloseTo(graphWheelZoomFactor(48, 0, 640));
    expect(graphWheelZoomFactor(0.125, 2, 640)).toBeCloseTo(graphWheelZoomFactor(80, 0, 640));
    expect(graphWheelZoomFactor(-1000000, 0, 640)).toBeLessThan(1.7);
    expect(graphWheelZoomFactor(1000000, 0, 640)).toBeGreaterThan(0.6);
  });
  it("focuses only the selected note and direct references without unrelated links", () => {
    const extended = { ...graph, nodes: [...graph.nodes, { id: "d", title: "Unrelated", category: "AI" }], edges: [...graph.edges, { source: "b", target: "c" }, { source: "c", target: "d" }] };
    expect(focusKnowledgeGraph(extended, "a")).toMatchObject({ nodes: graph.nodes, edges: graph.edges });
    expect(focusKnowledgeGraph(extended, "missing")).toMatchObject({ nodes: [], edges: [] });
    expect(focusKnowledgeGraph(extended, "d").nodes.map((node) => node.id)).toEqual(["c", "d"]);
    expect(focusKnowledgeGraph({ ...extended, edges: [] }, "d")).toMatchObject({ nodes: [extended.nodes[3]], edges: [] });
  });
  it("keeps full focus labels separated around a centered note, including high-degree phone views", () => {
    const many: KnowledgeGraph = { ...graph, nodes: [{ id: "a", title: "中心笔记", category: "Java" }, ...Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, title: `很长的关联笔记标题_${i}_需要完整显示并且不能重叠`, category: "AI" }))], edges: Array.from({ length: 40 }, (_, i) => ({ source: "a", target: `n${i}` })) };
    const focused = layoutFocusedKnowledgeGraph(many, "a", 360);
    expect(layoutFocusedKnowledgeGraph(many, "a", 360)).toEqual(focused);
    expect(focused.points.a).toEqual({ x: 180, y: focused.height / 2 });
    const boxes = many.nodes.map((node) => {
      const point = focused.points[node.id], label = focused.labels[node.id];
      expect(label.lines.join("")).toBe(node.title);
      return { left: point.x - label.width / 2, right: point.x + label.width / 2, top: point.y + label.offsetY - 14, bottom: point.y + label.offsetY - 14 + label.height };
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top).toBe(true);
    }
    const neighbors = many.nodes.slice(1).map((node) => focused.points[node.id]);
    expect(neighbors.some((point) => point.x < 180)).toBe(true);
    expect(neighbors.some((point) => point.x > 180)).toBe(true);
    expect(neighbors.some((point) => point.y < focused.height / 2)).toBe(true);
    expect(neighbors.some((point) => point.y > focused.height / 2)).toBe(true);
    const single = layoutFocusedKnowledgeGraph({ ...graph, nodes: graph.nodes.slice(0, 1), edges: [] }, "a", 360);
    expect(single.points.a).toEqual({ x: 180, y: single.height / 2 });
  });
  it("keeps a long title at the top of a small focused graph inside the canvas", () => {
    const sample: KnowledgeGraph = { ...graph, nodes: [graph.nodes[0], ...Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, title: i ? `关联笔记${i}` : "05_Positional Encoding 位置编码", category: "AI" }))], edges: [] };
    const focused = layoutFocusedKnowledgeGraph(sample, "a", 920);
    const point = focused.points.n0, label = focused.labels.n0;
    expect(label.lines.length).toBeGreaterThan(1);
    expect(point.y + label.offsetY - 14).toBeGreaterThanOrEqual(24);
    expect(point.y + label.offsetY + label.height).toBeLessThan(focused.height);
  });
  it("fills a round network rather than category islands or an empty ring", () => {
    const grouped: KnowledgeGraph = { ...graph, nodes: Array.from({ length: 160 }, (_, i) => ({ id: `${i}`, title: `Note ${i}`, category: i < 80 ? "AI" : "Java" })), edges: [] };
    const points = layoutKnowledgeGraph(grouped);
    expect(layoutKnowledgeGraph({ ...grouped, nodes: [...grouped.nodes].reverse() })).toEqual(points);
    expect(layoutKnowledgeGraph({ ...grouped, nodes: grouped.nodes.map((node) => ({ ...node, category: "One category" })) })).toEqual(points);
    const locations = Object.values(points);
    const spanX = Math.max(...locations.map((point) => point.x)) - Math.min(...locations.map((point) => point.x));
    const spanY = Math.max(...locations.map((point) => point.y)) - Math.min(...locations.map((point) => point.y));
    expect(spanX / spanY).toBeGreaterThan(0.85);
    expect(spanX / spanY).toBeLessThan(1.15);
    const radii = locations.map((point) => Math.hypot(point.x - 480, point.y - 320));
    const radius = Math.max(...radii);
    expect(radii.filter((value) => value < radius / 2).length).toBeGreaterThan(grouped.nodes.length * 0.15);
    expect(radii.filter((value) => value > radius * 0.75).length).toBeGreaterThan(grouped.nodes.length * 0.15);
    expect(new Set(Object.values(points).map((point) => Math.round(point.y))).size).toBeGreaterThan(20);
    for (const point of Object.values(layoutKnowledgeGraph(grouped, 360, 380))) { expect(point.x).toBeGreaterThanOrEqual(25); expect(point.x).toBeLessThanOrEqual(335); expect(point.y).toBeGreaterThanOrEqual(25); expect(point.y).toBeLessThanOrEqual(355); }
  });
});
