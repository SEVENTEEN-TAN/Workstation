type ArticleEmbedMapping = {
  target: string;
  id: string;
};

export function isArticleImageEmbedTarget(target: string) {
  return articleImageEmbedPath(target) !== null;
}

export function articleImageEmbedPath(target: string) {
  const path = target.split("|", 1)[0].split("#", 1)[0].trim();
  return /\.(?:png|jpe?g|webp)$/i.test(path) ? path : null;
}

export function validateArticleEmbedMappings(targets: string[], mappings: ArticleEmbedMapping[]) {
  const targetSet = new Set(targets);
  const mappingTargets = mappings.map(({ target }) => target);
  if (
    targetSet.size !== targets.length
    || mappingTargets.length !== new Set(mappingTargets).size
    || mappingTargets.length !== targetSet.size
    || mappingTargets.some((target) => !targetSet.has(target))
  ) {
    throw new Error("Article attachment mappings are incomplete");
  }
}

export function rewriteArticleEmbeds(markdown: string, mappings: ArticleEmbedMapping[]) {
  return mappings.reduce(
    (snapshot, mapping) => snapshot.replaceAll(`![[${mapping.target}]]`, `![](/api/knowledge/assets/${mapping.id})`),
    markdown,
  );
}
