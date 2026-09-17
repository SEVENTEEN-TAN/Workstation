import { knowledgeArticleAttachmentReader } from "@/lib/services/knowledge-article-attachments";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return knowledgeArticleAttachmentReader.get((await context.params).id, request.headers.get("if-none-match"));
}
