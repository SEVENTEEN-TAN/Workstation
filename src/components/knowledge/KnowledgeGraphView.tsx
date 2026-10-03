"use client";

import { Focus, Network, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import type { KnowledgeGraph } from "@/lib/knowledge/graph-contract";
import { clampGraphZoom, filterKnowledgeGraph, GRAPH_COLORS, GRAPH_HEIGHT, GRAPH_WIDTH, graphNeighbors, layoutKnowledgeGraph, type GraphPoint } from "@/lib/knowledge/graph-view";
import styles from "./knowledge-graph.module.css";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function KnowledgeGraphView({ graph }: { graph: KnowledgeGraph }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [hoverId, setHoverId] = useState("");
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [movedPoints, setMovedPoints] = useState<Record<string, GraphPoint>>({});
  const drag = useRef<{ id: string; start: GraphPoint; origin: GraphPoint; moved: boolean } | null>(null);
  const layout = useMemo(() => hydrated ? layoutKnowledgeGraph(graph) : {}, [graph, hydrated]);
  const categories = useMemo(() => [...new Set(graph.nodes.map((node) => node.category))].sort(), [graph]);
  const colors = useMemo(() => new Map(categories.map((name, index) => [name, GRAPH_COLORS[index % GRAPH_COLORS.length]])), [categories]);
  const visible = useMemo(() => filterKnowledgeGraph(graph, query, category), [graph, query, category]);
  const degrees = useMemo(() => {
    const result = new Map<string, number>();
    for (const edge of graph.edges) { result.set(edge.source, (result.get(edge.source) ?? 0) + 1); result.set(edge.target, (result.get(edge.target) ?? 0) + 1); }
    return result;
  }, [graph]);
  const featuredIds = useMemo(() => new Set([...graph.nodes].sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0)).slice(0, 6).map((node) => node.id)), [graph, degrees]);
  const selected = visible.nodes.find((node) => node.id === selectedId);
  const activeId = selected?.id ?? "";
  const neighbors = useMemo(() => graphNeighbors(visible, activeId), [visible, activeId]);
  const point = (id: string) => movedPoints[id] ?? layout[id];

  function zoomBy(factor: number) {
    setView((current) => {
      const zoom = clampGraphZoom(current.zoom * factor), ratio = zoom / current.zoom;
      return { zoom, x: GRAPH_WIDTH / 2 - (GRAPH_WIDTH / 2 - current.x) * ratio, y: GRAPH_HEIGHT / 2 - (GRAPH_HEIGHT / 2 - current.y) * ratio };
    });
  }

  function svgPoint(event: PointerEvent<SVGSVGElement>): GraphPoint {
    const matrix = event.currentTarget.getScreenCTM();
    const location = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix!.inverse());
    return { x: location.x, y: location.y };
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const id = (event.target as Element).closest("[data-node-id]")?.getAttribute("data-node-id") ?? "";
    drag.current = { id, start: svgPoint(event), origin: id ? point(id) : { x: view.x, y: view.y }, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current) return;
    const location = svgPoint(event), dx = location.x - current.start.x, dy = location.y - current.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) current.moved = true;
    if (current.id) setMovedPoints((points) => ({ ...points, [current.id]: { x: current.origin.x + dx / view.zoom, y: current.origin.y + dy / view.zoom } }));
    else setView((state) => ({ ...state, x: current.origin.x + dx, y: current.origin.y + dy }));
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current && !drag.current.moved) setSelectedId(drag.current.id);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  if (!hydrated) return <section className={styles.explorer} aria-label="知识图谱浏览器"><p className={styles.toolbar} role="status">正在载入知识图谱…</p></section>;

  return <section className={styles.explorer} aria-label="知识图谱浏览器">
    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记标题" aria-label="搜索笔记标题" /></label>
      <select aria-label="按技术分类筛选" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部分类</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <p className={styles.count} role="status">{visible.nodes.length} 篇笔记 <span>·</span> {visible.edges.length} 条引用</p>
    </div>
    <div className={styles.body}>
      <div className={styles.canvas}>
        <div className={styles.canvasHeading}><Network size={16} /><span>笔记关系图</span><small>节点大小表示引用数量</small></div>
        <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img" aria-label={`知识图谱：${visible.nodes.length} 篇笔记，${visible.edges.length} 条引用。可使用右侧笔记选择器浏览。`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { drag.current = null; }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {visible.edges.map((edge) => <line key={`${edge.source}:${edge.target}`} x1={point(edge.source).x} y1={point(edge.source).y} x2={point(edge.target).x} y2={point(edge.target).y} className={activeId ? edge.source === activeId || edge.target === activeId ? styles.edgeActive : styles.edgeDim : styles.edge} />)}
            {visible.nodes.map((node) => {
              const location = point(node.id), isSelected = node.id === activeId, isNeighbor = neighbors.all.has(node.id);
              const showLabel = isSelected || hoverId === node.id || (!activeId && (visible.nodes.length <= 20 || featuredIds.has(node.id)));
              return <g key={node.id} data-node-id={node.id} className={`${styles.node} ${activeId && !isSelected && !isNeighbor ? styles.nodeDim : ""}`} onPointerEnter={() => setHoverId(node.id)} onPointerLeave={() => setHoverId("")}>
                <title>{node.title} · {node.category}</title>
                {isSelected ? <circle cx={location.x} cy={location.y} r={14} className={styles.nodeHalo} /> : null}
                <circle cx={location.x} cy={location.y} r={Math.min(9, 3.2 + Math.sqrt(degrees.get(node.id) ?? 0) * 0.65)} fill={colors.get(node.category)} stroke={isSelected ? "#ffffff" : "#0d1116"} strokeWidth={isSelected ? 2 : 1} />
                {showLabel ? <text x={location.x + 12} y={location.y + 4}>{node.title.length > 22 ? `${node.title.slice(0, 22)}…` : node.title}</text> : null}
              </g>;
            })}
          </g>
        </svg>
        {!visible.nodes.length ? <div className={styles.noResults}><Search size={24} /><strong>没有匹配的笔记</strong><button type="button" onClick={() => { setQuery(""); setCategory(""); }}>清除筛选</button></div> : null}
        <div className={styles.canvasFooter}><span>拖动节点或空白区域</span><div className={styles.zoomControls}><button type="button" aria-label="缩小图谱" onClick={() => zoomBy(1 / 1.25)} disabled={view.zoom <= 0.5}><ZoomOut size={17} /></button><span aria-label="当前缩放">{Math.round(view.zoom * 100)}%</span><button type="button" aria-label="放大图谱" onClick={() => zoomBy(1.25)} disabled={view.zoom >= 4}><ZoomIn size={17} /></button><button type="button" aria-label="重置图谱视图" onClick={() => { setView({ zoom: 1, x: 0, y: 0 }); setMovedPoints({}); }}><Focus size={17} /></button></div></div>
      </div>
      <aside className={styles.sidebar} aria-label="笔记与关联">
        <label className={styles.notePicker}><span>选择笔记</span><select aria-label="选择笔记" value={activeId} onChange={(event) => setSelectedId(event.target.value)}><option value="">点击节点或选择笔记</option>{visible.nodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.category}</option>)}</select></label>
        {selected ? <div className={styles.noteDetails}><div className={styles.noteHeading}><span style={{ color: colors.get(selected.category) }}>{selected.category}</span><button type="button" aria-label="取消选择笔记" onClick={() => setSelectedId("")}><X size={16} /></button></div><h2>{selected.title}</h2><p>{neighbors.outgoing.size} 条出链 <span>·</span> {neighbors.incoming.size} 条反链</p><h3>关联笔记 <span>{neighbors.all.size}</span></h3>{neighbors.all.size ? <ul>{visible.nodes.filter((node) => neighbors.all.has(node.id)).map((node) => <li key={node.id}><button type="button" onClick={() => setSelectedId(node.id)}><span>{node.title}</span><small>{neighbors.outgoing.has(node.id) && neighbors.incoming.has(node.id) ? "互相引用" : neighbors.outgoing.has(node.id) ? "引用 →" : "← 被引用"}</small></button></li>)}</ul> : <p>当前范围内没有关联笔记。</p>}</div> : <div className={styles.selectHint}><Network size={30} /><h2>从一个想法出发。</h2><p>选择一篇笔记，查看它与其他知识的联系。</p></div>}
        <div className={styles.legend}><h3>技术分类</h3>{categories.map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(category === name ? "" : name)}><i style={{ background: colors.get(name) }} /><span>{name}</span><small>{graph.nodes.filter((node) => node.category === name).length}</small></button>)}</div>
      </aside>
    </div>
  </section>;
}
