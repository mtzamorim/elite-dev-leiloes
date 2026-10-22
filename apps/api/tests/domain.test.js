import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionState, minimumNextBid, extendedDeadline, validateBid, walletSnapshot } from '../src/domain/rules.js';
import { bidDigest, validateBidChain, anchorDigest, anonymousBidder, receiptDigest } from '../src/domain/crypto.js';

const now = new Date('2026-10-22T16:00:00Z');
const auction = { id:'lot',ownerId:'seller', status:'LIVE', startsAt:new Date(now.getTime()-60_000),endsAt:new Date(now.getTime()+120_000),initialBidCents:10000n,incrementCents:2500n,currentBidCents:null,leaderId:null,chainHead:'',nextSequence:1 };
const bidder = { id:'client', role:'BIDDER',balanceCents:50_000n,lockedCents:0n };
const secret = 'test-secret-super-long';

test('lote futuro, ativo e encerrando definidos pelas datas, não por status cacheado',()=>{
  assert.equal(auctionState({...auction,startsAt:new Date(now.getTime()+1_000)},now),'SCHEDULED');
  assert.equal(auctionState(auction,now),'LIVE');
  assert.equal(auctionState({...auction,endsAt:now},now),'FINISHING');
  assert.equal(auctionState({...auction,status:'CANCELED'},now),'CANCELED');
});
test('primeiro lance >= início; seguintes >= líder + incremento',()=>{
  assert.equal(minimumNextBid(auction),10000n);
  assert.equal(validateBid({auction,user:bidder,amountCents:10000n,now}),10000n);
  const progressed={...auction,currentBidCents:10000n,leaderId:'other'};
  assert.equal(minimumNextBid(progressed),12500n);
  assert.throws(()=>validateBid({auction:progressed,user:bidder,amountCents:12000n,now}),{code:'LOW_BID'});
});
test('protege o próprio lance, perfil, carteira e lotes fora do horário',()=>{
  assert.throws(()=>validateBid({auction,user:{...bidder,role:'AUCTIONEER'},amountCents:10000n,now}),{code:'ROLE'});
  assert.throws(()=>validateBid({auction:{...auction,leaderId:bidder.id},user:bidder,amountCents:10000n,now}),{code:'ALREADY_LEADING'});
  assert.throws(()=>validateBid({auction,user:{...bidder,lockedCents:49_000n},amountCents:10000n,now}),{code:'NO_FUNDS'});
  assert.throws(()=>validateBid({auction,user:bidder,amountCents:10000n,now:new Date(now.getTime()+120000)}),{code:'NOT_LIVE'});
  assert.throws(()=>validateBid({auction,user:{...bidder,id:'seller'},amountCents:10000n,now}),{code:'OWN_AUCTION'});
});
test('anti-sniping estende prazo nos últimos 120s, mas não depois do encerramento',()=>{
  assert.equal(extendedDeadline(auction.endsAt,now).getTime(),now.getTime()+240_000);
  assert.equal(extendedDeadline(new Date(now.getTime()+120_001),now).getTime(),now.getTime()+120_001);
  assert.equal(extendedDeadline(now,now).getTime(),now.getTime());
});
test('carteira disponível desconta apenas reservas',()=>{
  assert.deepEqual(walletSnapshot({...bidder,lockedCents:20000n}),{totalCents:50000n,committedCents:20000n,availableCents:30000n});
});
test('assinaturas expõem inserção, modificação, reordenação e exclusão intermediária',()=>{
  const first={auctionId:'lot',sequence:1,userId:'client',amountCents:10000n,createdAt:now,previousHash:''};
  first.signature=bidDigest(secret,first);
  const second={auctionId:'lot',sequence:2,userId:'other',amountCents:12500n,createdAt:new Date(now.getTime()+2000),previousHash:first.signature};
  second.signature=bidDigest(secret,second);
  const head={...auction,chainHead:second.signature,nextSequence:3,currentBidCents:12500n,leaderId:'other'};
  assert.equal(validateBidChain(secret,head,[first,second]).valid,true);
  assert.equal(validateBidChain(secret,head,[{...first,amountCents:500n},second]).valid,false);
  assert.equal(validateBidChain(secret,head,[second]).valid,false);
  assert.equal(validateBidChain(secret,head,[first,second,{...second,sequence:3}]).valid,false);
});
test('assinatura de âncora, anonimização e comprovante determinísticos',()=>{
  const anchor={auctionId:'lot',sequence:1,signature:'a'.repeat(64)};
  assert.match(anchorDigest(secret,anchor),/^[a-f0-9]{64}$/);
  assert.match(anonymousBidder(secret,'lot','client'),/^Licitante #[A-F0-9]{6}$/);
  const receipt={id:'rec',auctionId:'lot',bidId:'bid',winnerAlias:'Licitante #ABC123',amountCents:10000n,chainHead:'a'.repeat(64),createdAt:now};
  assert.notEqual(receiptDigest(secret,receipt),receiptDigest(secret,{...receipt,amountCents:10001n}));
});
