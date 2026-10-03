import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeGraphView } from "../src/components/knowledge/KnowledgeGraphView";
import type { KnowledgeGraph } from "../src/lib/knowledge/graph-contract";
import { clampGraphZoom, filterKnowledgeGraph, focusKnowledgeGraph, graphNeighbors, layoutFocusedKnowledgeGraph, layoutKnowledgeGraph } from "../src/lib/knowledge/graph-view";

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
  it("focuses only the selected note and direct references without unrelated links", () => {
    const extended = { ...graph, nodes: [...graph.nodes, { id: "d", title: "Unrelated", category: "AI" }], edges: [...graph.edges, { source: "b", target: "c" }, { source: "c", target: "d" }] };
    expect(focusKnowledgeGraph(extended, "a")).toMatchObject({ nodes: graph.nodes, edges: graph.edges });
    expect(focusKnowledgeGraph(extended, "missing")).toMatchObject({ nodes: [], edges: [] });
    expect(focusKnowledgeGraph(extended, "d").nodes.map((node) => node.id)).toEqual(["c", "d"]);
    expect(focusKnowledgeGraph({ ...extended, edges: [] }, "d")).toMatchObject({ nodes: [extended.nodes[3]], edges: [] });
  });
  it("keeps full focus labels in separate rows and inside a phone-width viewport", () => {
    const many: KnowledgeGraph = { ...graph, nodes: [{ id: "a", title: "中心笔记", category: "Java" }, ...Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, title: `很长的关联笔记标题_${i}_需要完整显示并且不能重叠`, category: "AI" }))], edges: Array.from({ length: 40 }, (_, i) => ({ source: "a", target: `n${i}` })) };
    const focused = layoutFocusedKnowledgeGraph(many, "a", 360);
    expect(focused.height).toBeGreaterThan(640);
    expect(layoutFocusedKnowledgeGraph(many, "a", 360)).toEqual(focused);
    const boxes = many.nodes.map((node) => {
      const point = focused.points[node.id], label = focused.labels[node.id];
      expect(label.lines.join("")).toBe(node.title);
      expect(point.x - 12).toBeGreaterThanOrEqual(12);
      expect(point.x - 12 + label.width).toBeLessThanOrEqual(348);
      return { top: point.y - label.height / 2, bottom: point.y + label.height / 2 };
    });
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].bottom);
    expect(layoutFocusedKnowledgeGraph({ ...graph, nodes: graph.nodes.slice(0, 1), edges: [] }, "a", 360).points.a.x).toBeGreaterThan(0);
  });
  it("groups unconnected categories around distinct anchors without grid bands", () => {
    const grouped: KnowledgeGraph = { ...graph, nodes: Array.from({ length: 40 }, (_, i) => ({ id: `${i}`, title: `Note ${i}`, category: i < 20 ? "AI" : "Java" })), edges: [] };
    const points = layoutKnowledgeGraph(grouped);
    const center = (category: string) => {
      const nodes = grouped.nodes.filter((node) => node.category === category);
      return nodes.reduce((sum, node) => ({ x: sum.x + points[node.id].x / nodes.length, y: sum.y + points[node.id].y / nodes.length }), { x: 0, y: 0 });
    };
    expect(Math.hypot(center("AI").x - center("Java").x, center("AI").y - center("Java").y)).toBeGreaterThan(300);
    expect(new Set(Object.values(points).map((point) => Math.round(point.y))).size).toBeGreaterThan(20);
    for (const point of Object.values(layoutKnowledgeGraph(grouped, 360, 380))) { expect(point.x).toBeGreaterThanOrEqual(45); expect(point.x).toBeLessThanOrEqual(315); }
  });
});
