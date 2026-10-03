"use client";

import { Focus, Network, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import type { KnowledgeGraph } from "@/lib/knowledge/graph-contract";
import { clampGraphZoom, filterKnowledgeGraph, focusKnowledgeGraph, GRAPH_COLORS, GRAPH_HEIGHT, GRAPH_WIDTH, graphNeighbors, layoutFocusedKnowledgeGraph, layoutKnowledgeGraph, type GraphPoint } from "@/lib/knowledge/graph-view";
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
  const [width, setWidth] = useState(GRAPH_WIDTH);
  const stage = useRef<HTMLDivElement>(null);
  const arrowId = useId();
  const drag = useRef<{ id: string; start: GraphPoint; origin: GraphPoint; moved: boolean } | null>(null);
  useEffect(() => {
    if (!hydrated || !stage.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [hydrated]);
  const categories = useMemo(() => [...new Set(graph.nodes.map((node) => node.category))].sort(), [graph]);
  const colors = useMemo(() => new Map(categories.map((name, index) => [name, GRAPH_COLORS[index % GRAPH_COLORS.length]])), [categories]);
  const visible = useMemo(() => filterKnowledgeGraph(graph, query, category), [graph, query, category]);
  const degrees = useMemo(() => {
    const result = new Map<string, number>();
    for (const edge of graph.edges) { result.set(edge.source, (result.get(edge.source) ?? 0) + 1); result.set(edge.target, (result.get(edge.target) ?? 0) + 1); }
    return result;
  }, [graph]);
  const selected = visible.nodes.find((node) => node.id === selectedId);
  const activeId = selected?.id ?? "";
  const neighbors = useMemo(() => graphNeighbors(visible, activeId), [visible, activeId]);
  const rendered = useMemo(() => activeId ? focusKnowledgeGraph(visible, activeId) : visible, [visible, activeId]);
  const focusedLayout = useMemo(() => layoutFocusedKnowledgeGraph(rendered, activeId, width), [rendered, activeId, width]);
  const height = activeId ? focusedLayout.height : Math.max(380, Math.min(GRAPH_HEIGHT, width * 0.8));
  const layout = useMemo(() => !hydrated ? {} : activeId ? focusedLayout.points : layoutKnowledgeGraph(visible, width, height), [hydrated, activeId, focusedLayout, visible, width, height]);
  const point = (id: string) => movedPoints[id] ?? layout[id];

  function selectNote(id: string) {
    setSelectedId(id); setHoverId(""); setView({ zoom: 1, x: 0, y: 0 }); setMovedPoints({});
    stage.current?.scrollTo({ top: 0 });
  }

  function zoomBy(factor: number) {
    setView((current) => {
      const zoom = clampGraphZoom(current.zoom * factor), ratio = zoom / current.zoom;
      const centerY = Math.min(height, stage.current?.clientHeight ?? height) / 2;
      return { zoom, x: width / 2 - (width / 2 - current.x) * ratio, y: centerY - (centerY - current.y) * ratio };
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
    if (drag.current && !drag.current.moved) selectNote(drag.current.id);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  if (!hydrated) return <section className={styles.explorer} aria-label="知识图谱浏览器"><p className={styles.toolbar} role="status">正在载入知识图谱…</p></section>;

  return <section className={styles.explorer} aria-label="知识图谱浏览器">
    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={16} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); selectNote(""); }} placeholder="搜索笔记标题" aria-label="搜索笔记标题" /></label>
      <select aria-label="按技术分类筛选" value={category} onChange={(event) => { setCategory(event.target.value); selectNote(""); }}><option value="">全部分类</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <p className={styles.count} role="status">{activeId ? `当前关联：${rendered.nodes.length} 篇 · ${rendered.edges.length} 条引用 / ` : ""}全图 {visible.nodes.length} 篇笔记 <span>·</span> {visible.edges.length} 条引用</p>
    </div>
    <div className={styles.body}>
      <div className={styles.canvas}>
        <div className={styles.canvasHeading}><Network size={16} /><span>{activeId ? "直接关联" : "笔记关系图"}</span>{activeId ? <button type="button" onClick={() => selectNote("")}>返回全图</button> : <small>选择节点查看清晰的直接关联</small>}</div>
        <div ref={stage} className={styles.graphStage}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ height }} role="img" aria-label={`知识图谱${activeId ? "直接关联" : "全图"}：${rendered.nodes.length} 篇笔记，${rendered.edges.length} 条引用。可使用笔记选择器浏览。`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { drag.current = null; }}>
          <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#72d9b2" /></marker></defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {rendered.edges.map((edge) => {
              const source = point(edge.source), target = point(edge.target);
              if (!activeId) return <line key={`${edge.source}:${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={styles.edge} />;
              const selectedPoint = point(activeId), selectedLabel = focusedLayout.labels[activeId];
              const targetPoint = edge.source === activeId ? target : source;
              const startX = selectedPoint.x + selectedLabel.width / 2 - 12, startY = selectedPoint.y + selectedLabel.height / 2 + 4;
              const laneX = targetPoint.x - 20, endX = targetPoint.x - 16, joinY = startY + 30;
              const route = [[startX, startY], [startX, joinY], [laneX, joinY], [laneX, targetPoint.y], [endX, targetPoint.y]];
              if (edge.target === activeId) route.reverse();
              return <path key={`${edge.source}:${edge.target}`} d={route.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ")} fill="none" className={styles.edgeActive} markerEnd={`url(#${arrowId})`} />;
            })}
            {rendered.nodes.map((node) => {
              const location = point(node.id), isSelected = node.id === activeId, label = focusedLayout.labels[node.id];
              const showLabel = !!activeId || hoverId === node.id || visible.nodes.length <= 8;
              const labelOnLeft = location.x > width * 0.65;
              return <g key={node.id} data-node-id={node.id} className={`${styles.node} ${activeId ? styles.focusNode : ""}`} role="button" tabIndex={0} aria-label={`${node.title}，${node.category}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNote(node.id); } }} onPointerEnter={() => setHoverId(node.id)} onPointerLeave={() => setHoverId("")}>
                <title>{node.title} · {node.category}</title>
                {activeId ? <rect x={location.x - 12} y={location.y - label.height / 2} width={label.width} height={label.height} rx={8} className={isSelected ? styles.focusCardSelected : styles.focusCard} /> : null}
                {isSelected ? <circle cx={location.x} cy={location.y} r={14} className={styles.nodeHalo} /> : null}
                <circle cx={location.x} cy={location.y} r={Math.min(9, 3.2 + Math.sqrt(degrees.get(node.id) ?? 0) * 0.65) * (activeId ? 1 : Math.min(1, width / 520))} fill={colors.get(node.category)} stroke={isSelected ? "#ffffff" : "#0d1116"} strokeWidth={isSelected ? 2 : 1} />
                {showLabel ? activeId ? <text x={location.x + 20} y={location.y - (label.lines.length - 1) * 10.5 + 5}>{label.lines.map((line, index) => <tspan key={index} x={location.x + 20} dy={index ? 21 : 0}>{line}</tspan>)}</text> : <text x={location.x + (labelOnLeft ? -12 : 12)} y={location.y + 4} textAnchor={labelOnLeft ? "end" : "start"}>{node.title.length > 18 ? `${node.title.slice(0, 18)}…` : node.title}</text> : null}
              </g>;
            })}
          </g>
        </svg>
        </div>
        {!visible.nodes.length ? <div className={styles.noResults}><Search size={24} /><strong>没有匹配的笔记</strong><button type="button" onClick={() => { setQuery(""); setCategory(""); }}>清除筛选</button></div> : null}
        <div className={styles.canvasFooter}><span>{activeId ? "箭头表示引用方向 · 更多关联可向下滚动" : "拖动节点或空白区域"}</span><div className={styles.zoomControls}><button type="button" aria-label="缩小图谱" onClick={() => zoomBy(1 / 1.25)} disabled={view.zoom <= 0.5}><ZoomOut size={17} /></button><span aria-label="当前缩放">{Math.round(view.zoom * 100)}%</span><button type="button" aria-label="放大图谱" onClick={() => zoomBy(1.25)} disabled={view.zoom >= 4}><ZoomIn size={17} /></button><button type="button" aria-label="重置图谱视图" onClick={() => { setView({ zoom: 1, x: 0, y: 0 }); setMovedPoints({}); stage.current?.scrollTo({ top: 0 }); }}><Focus size={17} /></button></div></div>
      </div>
      <aside className={styles.sidebar} aria-label="笔记与关联">
        <label className={styles.notePicker}><span>选择笔记</span><select aria-label="选择笔记" value={activeId} onChange={(event) => selectNote(event.target.value)}><option value="">点击节点或选择笔记</option>{visible.nodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.category}</option>)}</select></label>
        {selected ? <div className={styles.noteDetails}><div className={styles.noteHeading}><span style={{ color: colors.get(selected.category) }}>{selected.category}</span><button type="button" aria-label="取消选择笔记" onClick={() => selectNote("")}><X size={16} /></button></div><h2>{selected.title}</h2><p>{neighbors.outgoing.size} 条出链 <span>·</span> {neighbors.incoming.size} 条反链</p><h3>关联笔记 <span>{neighbors.all.size}</span></h3>{neighbors.all.size ? <ul>{visible.nodes.filter((node) => neighbors.all.has(node.id)).map((node) => <li key={node.id}><button type="button" onClick={() => selectNote(node.id)}><span>{node.title}</span><small>{neighbors.outgoing.has(node.id) && neighbors.incoming.has(node.id) ? "互相引用" : neighbors.outgoing.has(node.id) ? "引用 →" : "← 被引用"}</small></button></li>)}</ul> : <p>当前范围内没有关联笔记。</p>}</div> : <div className={styles.selectHint}><Network size={30} /><h2>从一个想法出发。</h2><p>选择一篇笔记，查看它与其他知识的联系。</p></div>}
        <div className={styles.legend}><h3>技术分类</h3>{categories.map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => { setCategory(category === name ? "" : name); selectNote(""); }}><i style={{ background: colors.get(name) }} /><span>{name}</span><small>{graph.nodes.filter((node) => node.category === name).length}</small></button>)}</div>
      </aside>
    </div>
  </section>;
}
