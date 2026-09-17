type ArticleEmbedMapping = {
  target: string;
  id: string;
};

export function isArticleImageEmbedTarget(target: string) {
  return /\.(?:png|jpe?g|webp)$/i.test(target);
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
