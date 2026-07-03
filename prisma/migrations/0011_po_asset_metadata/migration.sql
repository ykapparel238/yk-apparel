ALTER TABLE "FileAsset"
  ADD COLUMN "context" TEXT,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceId" TEXT;

CREATE INDEX "FileAsset_entityType_entityId_context_idx" ON "FileAsset"("entityType", "entityId", "context");
