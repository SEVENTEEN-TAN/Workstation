import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

import styles from "../../knowledge.module.css";
import { knowledgeCollectionService } from "@/lib/services/knowledge-collections";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = await knowledgeCollectionService.getPublic((await params).slug);
  return collection ? { title: `${collection.title} | SEVENTEEN`, description: collection.description ?? undefined } : { title: "Collection not found | SEVENTEEN" };
}

export default async function KnowledgeCollectionPage({ params }: Props) {
  const collection = await knowledgeCollectionService.getPublic((await params).slug);
  if (!collection) notFound();
  return <main className={styles.page}><header className={styles.header}><div className={styles.shell}><Link href="/knowledge/collections" className={styles.back}><ArrowLeft size={16} />返回主题合集</Link></div></header><article className={`${styles.shell} ${styles.article}`}><p className="eyebrow">KNOWLEDGE / COLLECTION</p><h1>{collection.title}</h1>{collection.description ? <p className={styles.summary}>{collection.description}</p> : null}<div className={styles.collectionReadingList}>{collection.articles.map((article, index) => <Link key={article.id} href={`/knowledge/${article.slug}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{article.title}</strong>{article.summary ? <p>{article.summary}</p> : null}</div><ArrowUpRight size={17} /></Link>)}</div></article></main>;
}
