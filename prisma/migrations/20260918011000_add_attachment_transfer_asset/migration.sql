ALTER TABLE "knowledge_attachment_transfer_requests" ADD COLUMN "asset_id" TEXT REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "knowledge_attachment_transfer_requests_asset_id_idx" ON "knowledge_attachment_transfer_requests"("asset_id");
