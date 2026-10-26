import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, statusForIndex, auctionDates, bidPrices, SEED_MARKER } from './seed-review-auctions.mjs';

const now = new Date('2026-10-26T12:00:00Z');

test('24 lotes criam 4 encerrados, 6 programados e 14 ao vivo', () => {
  const statuses = Array.from({length: 24}, (_, i) => statusForIndex(i, 24));
  assert.equal(statuses.filter(x=>x==='ENDED').length, 4);
  assert.equal(statuses.filter(x=>x==='SCHEDULED').length, 6);
  assert.equal(statuses.filter(x=>x==='LIVE').length, 14);
});

test('a quantidade se ajusta quando o avaliador escolhe um lote apenas', () => {
  assert.equal(statusForIndex(0, 1),'LIVE');
  assert.throws(()=>statusForIndex(1, 1),/inválido/);
});

test('lotes ativos começam no passado e encerram dentro de 60 dias', () => {
  const dates = auctionDates('LIVE', 12, now);
  assert.ok(dates.startsAt < now);
  assert.ok(dates.endsAt > now);
  assert.ok(dates.endsAt.getTime()-dates.startsAt.getTime() < 60*24*60*60_000);
});

test('lotes agendados começam após agora e encerram depois do início', () => {
  const dates = auctionDates('SCHEDULED', 7, now);
  assert.ok(dates.startsAt > now);
  assert.ok(dates.endsAt > dates.startsAt);
});

test('lotes encerrados apresentam prazo encerrado após início real', () => {
  const dates = auctionDates('ENDED', 1, now);
  assert.ok(dates.startsAt < dates.endsAt);
  assert.ok(dates.endsAt < now);
});

test('valores são inteiros positivos e aceitam incrementos mínimos', () => {
  for (let i=0;i<60;i++) {
    const prices = bidPrices(i);
    assert.ok(Number.isSafeInteger(prices.initialCents));
    assert.ok(Number.isSafeInteger(prices.incrementCents));
    assert.ok(prices.initialCents > prices.incrementCents);
  }
});

test('script bloqueia parâmetros inválidos e admite preview sem gravação', () => {
  assert.deepEqual(parseArgs(['--count=24','--confirm-demo']), {count:24,dryRun:false,confirmDemo:true,withBids:true});
  assert.deepEqual(parseArgs(['--count','8','--dry-run','--no-bids']), {count:8,dryRun:true,confirmDemo:false,withBids:false});
  assert.throws(()=>parseArgs(['--count=0']),/inteiro/);
  assert.throws(()=>parseArgs(['--count=100']),/inteiro/);
  assert.throws(()=>parseArgs(['--delete-all']),/desconhecido/);
});

test('marcador estável permite identificar os lotes do seed sem apagar existentes', () => {
  assert.equal(typeof SEED_MARKER,'string');
  assert.ok(SEED_MARKER.startsWith('[') && SEED_MARKER.endsWith(']'));
});
