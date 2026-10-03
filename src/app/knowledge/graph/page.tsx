import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Network } from "lucide-react";
import { KnowledgeGraphView } from "@/components/knowledge/KnowledgeGraphView";
import { getPublishedKnowledgeGraph } from "@/lib/services/knowledge-graph";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "技术知识图谱 | SEVENTEEN", description: "探索技术笔记的引用关系，从一个想法发现更多联系。" };

export default async function KnowledgeGraphPage() {
  const graph = await getPublishedKnowledgeGraph();
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.shell}><Link href="/"><ArrowLeft size={15} />返回主页</Link><Link href="/knowledge">公开文章<ArrowUpRight size={15} /></Link></div></header>
    <section className={`${styles.shell} ${styles.hero}`}><p className={styles.eyebrow}>KNOWLEDGE / CONNECTIONS</p><h1>技术知识<span>图谱。</span></h1><p className={styles.description}>每一篇笔记，都是知识网络的一部分。探索想法之间的联系。</p>{graph ? <div className={styles.stats}><span><strong>{graph.nodes.length}</strong> 篇笔记</span><i /><span><strong>{graph.edges.length}</strong> 条引用</span><i /><span><strong>{new Set(graph.nodes.map((node) => node.category)).size}</strong> 个分类</span></div> : null}</section>
    <section className={`${styles.shell} ${styles.graphSection}`}>{graph ? <KnowledgeGraphView graph={graph} /> : <div className={styles.empty}><Network size={32} /><h2>知识地图正在整理中</h2><p>完成整理并发布后，笔记之间的联系会在这里出现。</p><Link href="/knowledge">浏览公开文章<ArrowUpRight size={15} /></Link></div>}<p className={styles.footerNote}>这里展示笔记标题与引用关系。选择节点查看关联，正文与附件不在图谱中展示。</p></section>
  </main>;
}
