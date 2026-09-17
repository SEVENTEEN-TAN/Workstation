import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";

import styles from "../knowledge.module.css";
import { knowledgeCollectionService } from "@/lib/services/knowledge-collections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Knowledge Collections | SEVENTEEN", description: "Curated public knowledge collections from SEVENTEEN." };

export default async function KnowledgeCollectionsPage() {
  const collections = await knowledgeCollectionService.listPublic();
  return <main className={styles.page}><header className={styles.header}><div className={styles.shell}><Link href="/knowledge" className={styles.back}><ArrowLeft size={16} />返回知识库</Link></div></header><section className={`${styles.hero} hero-grid`}><div className={styles.shell}><p className="eyebrow">PERSONAL WORKSTATION / COLLECTIONS</p><h1>主题合集。</h1><p>围绕一个技术主题或工作命题，按阅读路径整理已经公开的知识内容。</p></div></section><section className={`${styles.shell} ${styles.articleSection}`}>{collections.length ? <div className={styles.articleList}>{collections.map((collection) => <article key={collection.id} className={styles.articleCard}><div className={styles.articleMeta}><span>{collection.articles.length} 篇文章</span><span>COLLECTION</span></div><h2><Link href={`/knowledge/collections/${collection.slug}`}>{collection.title}</Link></h2>{collection.description ? <p>{collection.description}</p> : null}<Link href={`/knowledge/collections/${collection.slug}`} className={styles.readMore}>查看合集</Link></article>)}</div> : <div className={styles.empty}><FolderKanban size={26} /><h2>暂时没有公开合集</h2><p>主题文章整理完成并设为公开后，会在这里出现。</p></div>}</section></main>;
}
