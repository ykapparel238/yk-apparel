-- CreateEnum
CREATE TYPE "WorkflowChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WorkflowEditLock" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEditLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowChangeRequest" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "WorkflowChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterUserId" TEXT,
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEditLock_module_entityType_entityId_operation_key" ON "WorkflowEditLock"("module", "entityType", "entityId", "operation");

-- CreateIndex
CREATE INDEX "WorkflowEditLock_actorUserId_idx" ON "WorkflowEditLock"("actorUserId");

-- CreateIndex
CREATE INDEX "WorkflowEditLock_module_entityType_idx" ON "WorkflowEditLock"("module", "entityType");

-- CreateIndex
CREATE INDEX "WorkflowChangeRequest_status_createdAt_idx" ON "WorkflowChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowChangeRequest_module_entityType_entityId_idx" ON "WorkflowChangeRequest"("module", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowChangeRequest_requesterUserId_idx" ON "WorkflowChangeRequest"("requesterUserId");

-- CreateIndex
CREATE INDEX "WorkflowChangeRequest_reviewerUserId_idx" ON "WorkflowChangeRequest"("reviewerUserId");

-- AddForeignKey
ALTER TABLE "WorkflowEditLock" ADD CONSTRAINT "WorkflowEditLock_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowChangeRequest" ADD CONSTRAINT "WorkflowChangeRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowChangeRequest" ADD CONSTRAINT "WorkflowChangeRequest_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
