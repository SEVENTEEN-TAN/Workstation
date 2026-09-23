ALTER TABLE "action_items" ADD COLUMN "generated_from_action_item_id" TEXT REFERENCES "action_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD COLUMN "has_generated_next" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "action_items_generated_from_action_item_id_key" ON "action_items"("generated_from_action_item_id");
