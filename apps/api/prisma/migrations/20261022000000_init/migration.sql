-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AUCTIONEER', 'BIDDER');
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELED');
CREATE TYPE "WalletEntryKind" AS ENUM ('DEPOSIT', 'RESERVE', 'RELEASE', 'SETTLEMENT_DEBIT', 'SETTLEMENT_CREDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "balanceCents" BIGINT NOT NULL DEFAULT 0,
    "lockedCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Auction" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "winnerId" UUID,
    "artworkId" INTEGER NOT NULL,
    "title" VARCHAR(280) NOT NULL,
    "artist" VARCHAR(280) NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "artworkDate" VARCHAR(100) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "initialBidCents" BIGINT NOT NULL,
    "incrementCents" BIGINT NOT NULL,
    "currentBidCents" BIGINT,
    "leaderId" UUID,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "chainHead" TEXT NOT NULL DEFAULT '',
    "cancellationReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bid" (
    "id" UUID NOT NULL,
    "auctionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "previousHash" TEXT NOT NULL DEFAULT '',
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "auctionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "auctionId" UUID NOT NULL,
    "bidId" UUID NOT NULL,
    "winnerAlias" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "chainHead" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Auction_status_startsAt_endsAt_idx" ON "Auction"("status", "startsAt", "endsAt");
CREATE INDEX "Auction_ownerId_createdAt_idx" ON "Auction"("ownerId", "createdAt");
CREATE UNIQUE INDEX "Bid_auctionId_sequence_key" ON "Bid"("auctionId", "sequence");
CREATE INDEX "Bid_userId_createdAt_idx" ON "Bid"("userId", "createdAt");
CREATE INDEX "WalletEntry_userId_createdAt_idx" ON "WalletEntry"("userId", "createdAt");
CREATE UNIQUE INDEX "Receipt_auctionId_key" ON "Receipt"("auctionId");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
