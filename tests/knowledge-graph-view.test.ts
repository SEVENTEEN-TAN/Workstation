import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeGraphView } from "../src/components/knowledge/KnowledgeGraphView";
import type { KnowledgeGraph } from "../src/lib/knowledge/graph-contract";
import { clampGraphZoom, filterKnowledgeGraph, graphNeighbors, layoutKnowledgeGraph } from "../src/lib/knowledge/graph-view";

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
});
