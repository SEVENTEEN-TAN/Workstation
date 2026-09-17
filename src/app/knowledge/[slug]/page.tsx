import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { KnowledgeMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import styles from "../knowledge.module.css";
import { knowledgeArticleService } from "@/lib/services/knowledge-articles";

export const dynamic = "force-dynamic";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await knowledgeArticleService.getPublicArticle((await params).slug);
  return article ? { title: `${article.title} | SEVENTEEN`, description: article.summary ?? undefined } : { title: "Article not found | SEVENTEEN" };
}

export default async function KnowledgeArticlePage({ params }: ArticlePageProps) {
  const article = await knowledgeArticleService.getPublicArticle((await params).slug);
  if (!article) notFound();
  const publishedAt = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(article.publishedAt);

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.shell}><Link href="/knowledge" className={styles.back}><ArrowLeft size={16} />返回知识库</Link></div></header>
    <article className={`${styles.shell} ${styles.article}`}>
      <p className="eyebrow">KNOWLEDGE / {publishedAt}</p>
      <h1>{article.title}</h1>
      {article.summary ? <p className={styles.summary}>{article.summary}</p> : null}
      {article.tags.length ? <ul className={styles.tags}>{article.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}
      <KnowledgeMarkdown content={article.markdown} />
    </article>
  </main>;
}
