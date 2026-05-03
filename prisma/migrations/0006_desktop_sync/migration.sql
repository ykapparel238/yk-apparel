CREATE TABLE "DesktopDevice" (
  "id" TEXT NOT NULL,
  "clientVersion" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL DEFAULT 'default',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "rebuildRequired" BOOLEAN NOT NULL DEFAULT false,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessedBundle" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL DEFAULT 'default',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "clientVersion" TEXT NOT NULL,
  "result" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedBundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedBundle_bundleId_key" ON "ProcessedBundle"("bundleId");
CREATE INDEX "ProcessedBundle_deviceId_processedAt_idx" ON "ProcessedBundle"("deviceId", "processedAt");

CREATE TABLE "ProcessedMutation" (
  "id" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "processedBundleId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "baseVersion" TEXT,
  "result" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedMutation_mutationId_key" ON "ProcessedMutation"("mutationId");
CREATE INDEX "ProcessedMutation_bundleId_idx" ON "ProcessedMutation"("bundleId");
CREATE INDEX "ProcessedMutation_deviceId_processedAt_idx" ON "ProcessedMutation"("deviceId", "processedAt");

CREATE TABLE "SyncCheckpoint" (
  "id" TEXT NOT NULL,
  "checkpointId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "cursorAt" TIMESTAMP(3) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ok',
  CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncCheckpoint_checkpointId_key" ON "SyncCheckpoint"("checkpointId");
CREATE INDEX "SyncCheckpoint_deviceId_issuedAt_idx" ON "SyncCheckpoint"("deviceId", "issuedAt");

CREATE TABLE "SyncConflict" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "conflictType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "localSnapshot" JSONB NOT NULL,
  "serverSnapshot" JSONB NOT NULL,
  "chosenAction" TEXT,
  "rationale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncConflict_deviceId_createdAt_idx" ON "SyncConflict"("deviceId", "createdAt");
CREATE INDEX "SyncConflict_bundleId_mutationId_idx" ON "SyncConflict"("bundleId", "mutationId");

ALTER TABLE "ProcessedBundle"
  ADD CONSTRAINT "ProcessedBundle_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessedMutation"
  ADD CONSTRAINT "ProcessedMutation_processedBundleId_fkey"
  FOREIGN KEY ("processedBundleId") REFERENCES "ProcessedBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncCheckpoint"
  ADD CONSTRAINT "SyncCheckpoint_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncConflict"
  ADD CONSTRAINT "SyncConflict_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
