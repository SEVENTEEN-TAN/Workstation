type PublicationRevision = {
  id: string;
  contentHash: string;
  capturedAt: string;
  draft: { article: { slug: string } | null } | null;
};

export function getPublicationUpdate(revisions: PublicationRevision[], currentContentHash?: string) {
  const latest = revisions.reduce<PublicationRevision | null>((current, revision) => (
    !current || new Date(revision.capturedAt) > new Date(current.capturedAt) ? revision : current
  ), null);
  const published = revisions
    .filter((revision) => revision.draft?.article)
    .sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime())[0];

  if (!latest || !published?.draft?.article) return null;
  return {
    articleSlug: published.draft.article.slug,
    latestRevisionId: latest.id,
    updateAvailable: (currentContentHash ?? latest.contentHash) !== published.contentHash,
  };
}
