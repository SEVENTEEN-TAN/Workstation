import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, FolderKanban, Search, X } from "lucide-react";

import styles from "./knowledge.module.css";
import { filterPublicKnowledgeArticles } from "@/lib/knowledge/public-article-search";
import { knowledgeArticleService } from "@/lib/services/knowledge-articles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge | SEVENTEEN",
  description: "Public notes and technical writing from SEVENTEEN.",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(value);
}

function knowledgeHref(query: string, tag: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  const serialized = params.toString();
  return serialized ? `/knowledge?${serialized}` : "/knowledge";
}

type KnowledgePageProps = { searchParams: Promise<{ q?: string; tag?: string }> };

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const [{ q, tag }, allArticles] = await Promise.all([searchParams, knowledgeArticleService.listPublicArticles()]);
  const query = q?.trim() ?? "";
  const selectedTag = tag?.trim() ?? "";
  const articles = filterPublicKnowledgeArticles(allArticles, { query, tag: selectedTag });
  const tags = [...new Set(allArticles.flatMap((article) => article.tags))].sort((left, right) => left.localeCompare(right));
  const hasFilters = Boolean(query || selectedTag);

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.shell}><Link href="/" className={styles.back}><ArrowLeft size={16} />返回主页</Link></div></header>
    <section className={`${styles.hero} hero-grid`}><div className={styles.shell}><p className="eyebrow">PERSONAL WORKSTATION / KNOWLEDGE</p><h1>公开知识库。</h1><p>沉淀已整理完成、可公开分享的技术笔记与工作方法。</p></div></section>
    <section className={`${styles.shell} ${styles.articleSection}`}>
      {allArticles.length ? <><div className={styles.knowledgeLinks}><Link href="/knowledge/collections"><FolderKanban size={15} />浏览主题合集</Link></div><form className={styles.filterForm} action="/knowledge"><label className={styles.filterInput}><Search size={16} /><span className={styles.srOnly}>搜索文章</span><input name="q" type="search" defaultValue={query} placeholder="搜索文章、标签或正文" /></label><select name="tag" defaultValue={tags.find((item) => item.toLocaleLowerCase() === selectedTag.toLocaleLowerCase()) ?? ""} aria-label="按标签筛选"><option value="">所有标签</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="submit">筛选</button>{hasFilters ? <Link href="/knowledge" className={styles.clearFilters}><X size={15} />清除</Link> : null}</form><div className={styles.tagList} aria-label="文章标签"><Link href={knowledgeHref(query, "")} className={!selectedTag ? styles.tagActive : ""}>全部</Link>{tags.map((item) => <Link key={item} href={knowledgeHref(query, item)} className={item.toLocaleLowerCase() === selectedTag.toLocaleLowerCase() ? styles.tagActive : ""}>{item}</Link>)}</div>{articles.length ? <div className={styles.articleList}>{articles.map((article) => <article key={article.id} className={styles.articleCard}>
        <div className={styles.articleMeta}><time dateTime={article.publishedAt.toISOString()}>{formatDate(article.publishedAt)}</time><span>{article.tags.length ? article.tags.join(" · ") : "NOTE"}</span></div>
        <h2><Link href={`/knowledge/${article.slug}`}>{article.title}</Link></h2>
        {article.summary ? <p>{article.summary}</p> : null}
        <Link href={`/knowledge/${article.slug}`} className={styles.readMore}>阅读全文<ArrowUpRight size={16} /></Link>
      </article>)}</div> : <div className={styles.empty}><Search size={26} /><h2>没有匹配的文章</h2><p>尝试调整关键词或标签筛选。</p></div>}</> : <div className={styles.empty}><BookOpen size={26} /><h2>暂时没有公开文章</h2><p>完成整理并发布的知识内容，会在这里出现。</p></div>}
    </section>
  </main>;
}
