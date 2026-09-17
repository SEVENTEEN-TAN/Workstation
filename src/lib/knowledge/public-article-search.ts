type SearchablePublicArticle = {
  title: string;
  summary: string | null;
  tags: string[];
  markdown: string;
};

type PublicArticleSearch = { query?: string; tag?: string };

function normalize(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function filterPublicKnowledgeArticles<T extends SearchablePublicArticle>(articles: T[], search: PublicArticleSearch) {
  const query = normalize(search.query);
  const tag = normalize(search.tag);
  return articles.filter((article) => {
    const hasTag = !tag || article.tags.some((item) => normalize(item) === tag);
    const searchable = [article.title, article.summary, ...article.tags, article.markdown].filter(Boolean).join("\n").toLocaleLowerCase();
    return hasTag && (!query || searchable.includes(query));
  });
}
