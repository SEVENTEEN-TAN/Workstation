import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";

import styles from "./knowledge.module.css";
import { knowledgeArticleService } from "@/lib/services/knowledge-articles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge | SEVENTEEN",
  description: "Public notes and technical writing from SEVENTEEN.",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(value);
}

export default async function KnowledgePage() {
  const articles = await knowledgeArticleService.listPublicArticles();

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.shell}><Link href="/" className={styles.back}><ArrowLeft size={16} />返回主页</Link></div></header>
    <section className={`${styles.hero} hero-grid`}><div className={styles.shell}><p className="eyebrow">PERSONAL WORKSTATION / KNOWLEDGE</p><h1>公开知识库。</h1><p>沉淀已整理完成、可公开分享的技术笔记与工作方法。</p></div></section>
    <section className={`${styles.shell} ${styles.articleSection}`}>
      {articles.length ? <div className={styles.articleList}>{articles.map((article) => <article key={article.id} className={styles.articleCard}>
        <div className={styles.articleMeta}><time dateTime={article.publishedAt.toISOString()}>{formatDate(article.publishedAt)}</time><span>{article.tags.length ? article.tags.join(" · ") : "NOTE"}</span></div>
        <h2><Link href={`/knowledge/${article.slug}`}>{article.title}</Link></h2>
        {article.summary ? <p>{article.summary}</p> : null}
        <Link href={`/knowledge/${article.slug}`} className={styles.readMore}>阅读全文<ArrowUpRight size={16} /></Link>
      </article>)}</div> : <div className={styles.empty}><BookOpen size={26} /><h2>暂时没有公开文章</h2><p>完成整理并发布的知识内容，会在这里出现。</p></div>}
    </section>
  </main>;
}
