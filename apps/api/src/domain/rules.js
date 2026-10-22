/** Regras puras de leilão; sem banco, rede ou estado global. */
export class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}

export function auctionState(auction, now = new Date()) {
  if (auction.status === 'CANCELED') return 'CANCELED';
  if (auction.status === 'ENDED' || auction.finishedAt) return 'ENDED';
  if (now < new Date(auction.startsAt)) return 'SCHEDULED';
  if (now >= new Date(auction.endsAt)) return 'FINISHING';
  return 'LIVE';
}

export function minimumNextBid(auction) {
  return auction.currentBidCents === null || auction.currentBidCents === undefined
    ? BigInt(auction.initialBidCents)
    : BigInt(auction.currentBidCents) + BigInt(auction.incrementCents);
}

export function validateBid({ auction, user, amountCents, now = new Date() }) {
  if (!user || user.role !== 'BIDDER') throw new DomainError('ROLE', 'Somente licitantes podem dar lances.', 403);
  if (auctionState(auction, now) !== 'LIVE') throw new DomainError('NOT_LIVE', 'Este lote não está recebendo lances.', 409);
  if (auction.ownerId === user.id) throw new DomainError('OWN_AUCTION', 'Você não pode dar lance em seu próprio lote.', 403);
  if (auction.leaderId === user.id) throw new DomainError('ALREADY_LEADING', 'Você já está ganhando este lote.', 409);
  const value = BigInt(amountCents);
  if (value < minimumNextBid(auction)) throw new DomainError('LOW_BID', 'O lance está abaixo do mínimo permitido.', 409);
  if (BigInt(user.balanceCents) - BigInt(user.lockedCents) < value) throw new DomainError('NO_FUNDS', 'Saldo disponível insuficiente para este lance.', 409);
  return value;
}

export function extendedDeadline(endsAt, now = new Date()) {
  const end = new Date(endsAt).getTime();
  const remaining = end - now.getTime();
  // Inclusivo em 2 minutos; exatamente no encerramento não há lance válido.
  return remaining > 0 && remaining <= 120_000 ? new Date(end + 120_000) : new Date(end);
}

export function walletSnapshot(user) {
  return {
    totalCents: BigInt(user.balanceCents),
    committedCents: BigInt(user.lockedCents),
    availableCents: BigInt(user.balanceCents) - BigInt(user.lockedCents)
  };
}
