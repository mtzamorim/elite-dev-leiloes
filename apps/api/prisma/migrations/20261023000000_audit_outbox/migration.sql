-- The outbox entry is inserted in the same transaction as its signed bid.
-- Intentionally no FK to Bid: a direct SQL deletion must remain auditable.
CREATE TABLE "AuditAnchorOutbox" (
    "auctionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "seal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    CONSTRAINT "AuditAnchorOutbox_pkey" PRIMARY KEY ("auctionId", "sequence")
);
CREATE INDEX "AuditAnchorOutbox_syncedAt_createdAt_idx" ON "AuditAnchorOutbox"("syncedAt", "createdAt");
