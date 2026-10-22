import { createHmac, timingSafeEqual } from 'node:crypto';

const hmac = (secret, input) => createHmac('sha256', secret).update(input).digest('hex');
export const equalDigest = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

// Serialização canônica explícita (inclui ordem, entidade, pessoa, valor, tempo e elo anterior).
export function bidDigest(secret, bid) {
  return hmac(secret, JSON.stringify([
    'BID:v1', bid.auctionId, bid.sequence, bid.userId,
    String(bid.amountCents), new Date(bid.createdAt).toISOString(), bid.previousHash
  ]));
}

export function anchorDigest(secret, anchor) {
  return hmac(secret, JSON.stringify(['ANCHOR:v1', anchor.auctionId, anchor.sequence, anchor.signature]));
}

export function anonymousBidder(secret, auctionId, userId) {
  return `Licitante #${hmac(secret, `ALIAS:v1:${auctionId}:${userId}`).slice(0, 6).toUpperCase()}`;
}

export function receiptDigest(secret, receipt) {
  return hmac(secret, JSON.stringify([
    'RECEIPT:v1', receipt.id, receipt.auctionId, receipt.bidId,
    receipt.winnerAlias, String(receipt.amountCents), receipt.chainHead,
    new Date(receipt.createdAt).toISOString()
  ]));
}

export function validateBidChain(secret, auction, orderedBids) {
  let expectedPrevious = '';
  for (let i = 0; i < orderedBids.length; i++) {
    const bid = orderedBids[i];
    if (bid.auctionId !== auction.id || bid.sequence !== i + 1 || bid.previousHash !== expectedPrevious) {
      return { valid: false, reason: `Sequência/encadeamento inválido na posição ${i + 1}.` };
    }
    if (!equalDigest(bid.signature, bidDigest(secret, bid))) {
      return { valid: false, reason: `Assinatura inválida no lance ${i + 1}.` };
    }
    expectedPrevious = bid.signature;
  }
  if (auction.nextSequence !== orderedBids.length + 1 || auction.chainHead !== expectedPrevious) {
    return { valid: false, reason: 'Cabeçalho do lote divergente do histórico de lances.' };
  }
  const last = orderedBids.at(-1);
  if (last && (String(last.amountCents) !== String(auction.currentBidCents) || last.userId !== auction.leaderId)) {
    return { valid: false, reason: 'Liderança/valor do lote divergem do último lance.' };
  }
  if (!last && (auction.currentBidCents !== null || auction.leaderId !== null)) {
    return { valid: false, reason: 'Lote sem lances possui liderança ou valor indevidos.' };
  }
  return { valid: true, reason: 'Histórico encadeado e assinado corretamente.' };
}
