-- Backwards-compatible migration: existing auctions keep their Art Institute identity.
CREATE TYPE "ArtworkSource" AS ENUM ('ART_INSTITUTE', 'CLEVELAND');
ALTER TABLE "Auction"
  ADD COLUMN "artworkSource" "ArtworkSource" NOT NULL DEFAULT 'ART_INSTITUTE',
  ADD COLUMN "artworkUrl" TEXT;
