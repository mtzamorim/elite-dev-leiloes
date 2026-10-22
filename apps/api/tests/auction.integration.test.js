import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dbUrl=process.env.TEST_DATABASE_URL;

test('integração PostgreSQL: concorrência, estorno, liquidação idempotente e adulteração', {skip:!dbUrl?'Defina TEST_DATABASE_URL e execute as migrações no banco de testes.':false,timeout:30000},async()=>{
  // A importação é posterior à configuração para nunca tocar inadvertidamente no banco de desenvolvimento.
  process.env.DATABASE_URL=dbUrl;
  process.env.JWT_SECRET='test-only-jwt-secret-012345678901234';
  process.env.AUDIT_SECRET='test-only-audit-secret-012345678901';
  const {prisma}=await import('../src/lib/db.js');
  const {placeBid,cancelAuction,settleAuction}=await import('../src/services/auctions.js');
  const {auctionAudit}=await import('../src/services/audit.js');
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-integration-'));
  const secret=process.env.AUDIT_SECRET;
  const anchorFile=path.join(folder,'audit.ndjson');
  const ids=[];
  const userIds=[];
  const email=(name)=>`${name}-${randomUUID()}@test.invalid`;
  const createUser=async(name,role,balanceCents)=>{
    const user=await prisma.user.create({data:{name,email:email(name),role,passwordHash:'test-only-not-authenticable',balanceCents}});
    userIds.push(user.id);
    return user;
  };
  const makeLot=async(ownerId)=>{
    const a=await prisma.auction.create({data:{ownerId,artworkId:27992,title:'Lote de teste',artist:'Artista fictício',imageUrl:'',artworkDate:'2026',initialBidCents:10000n,incrementCents:2000n,startsAt:new Date(Date.now()-300_000),endsAt:new Date(Date.now()+3_600_000),status:'LIVE'}});
    ids.push(a.id);
    return a;
  };
  try {
    const seller=await createUser('seller','AUCTIONEER',0n);
    const a=await createUser('bidder-a','BIDDER',100000n);
    const b=await createUser('bidder-b','BIDDER',100000n);
    const lot=await makeLot(seller.id);
    await placeBid({auctionId:lot.id,userId:a.id,amountCents:10000,secret,anchorFile});
    await assert.rejects(()=>placeBid({auctionId:lot.id,userId:a.id,amountCents:12000,secret,anchorFile}),{code:'ALREADY_LEADING'});
    const concurrent=await Promise.allSettled([
      placeBid({auctionId:lot.id,userId:b.id,amountCents:12000,secret,anchorFile}),
      placeBid({auctionId:lot.id,userId:a.id,amountCents:14000,secret,anchorFile})
    ]);
    assert.ok(concurrent.some(x=>x.status==='fulfilled'));
    const [current,alice,bob]=await Promise.all([
      prisma.auction.findUniqueOrThrow({where:{id:lot.id}}),
      prisma.user.findUniqueOrThrow({where:{id:a.id}}),
      prisma.user.findUniqueOrThrow({where:{id:b.id}})
    ]);
    assert.equal(alice.lockedCents+bob.lockedCents,current.currentBidCents);
    assert.equal(current.nextSequence-1,await prisma.bid.count({where:{auctionId:lot.id}}));
    assert.equal((await auctionAudit(prisma,current,{secret,filename:anchorFile})).status,'INTEGRO');

    await prisma.auction.update({where:{id:lot.id},data:{endsAt:new Date(Date.now()-1000)}});
    const settlements=await Promise.all([
      settleAuction({auctionId:lot.id,secret,anchorFile}),
      settleAuction({auctionId:lot.id,secret,anchorFile})
    ]);
    assert.equal(settlements.filter(Boolean).length,1,'somente uma liquidação ocorreu');
    const [receipt,sellerAfter,winnerAfter]=await Promise.all([
      prisma.receipt.findUnique({where:{auctionId:lot.id}}),
      prisma.user.findUniqueOrThrow({where:{id:seller.id}}),
      prisma.user.findUniqueOrThrow({where:{id:current.leaderId}})
    ]);
    assert.ok(receipt);
    assert.equal(sellerAfter.balanceCents,current.currentBidCents);
    assert.equal(winnerAfter.lockedCents,0n);
    assert.equal(winnerAfter.balanceCents,100000n-current.currentBidCents);

    const cancelLot=await makeLot(seller.id);
    await placeBid({auctionId:cancelLot.id,userId:b.id,amountCents:10000,secret,anchorFile});
    await assert.rejects(()=>cancelAuction({auctionId:cancelLot.id,ownerId:seller.id,reason:'curto'}),{code:'CANCEL_REASON'});
    await cancelAuction({auctionId:cancelLot.id,ownerId:seller.id,reason:'Retirada justificada para teste automatizado.'});
    assert.equal((await prisma.user.findUniqueOrThrow({where:{id:b.id}})).lockedCents,0n);
    assert.equal((await prisma.auction.findUniqueOrThrow({where:{id:cancelLot.id}})).status,'CANCELED');

    const firstBid=await prisma.bid.findFirstOrThrow({where:{auctionId:lot.id},orderBy:{sequence:'asc'}});
    await prisma.$executeRaw`UPDATE "Bid" SET "amountCents" = "amountCents" + 1 WHERE id = ${firstBid.id}::uuid`;
    const tampered=await prisma.auction.findUniqueOrThrow({where:{id:lot.id}});
    assert.equal((await auctionAudit(prisma,tampered,{secret,filename:anchorFile})).status,'ALTERADO');
  } finally {
    await prisma.receipt.deleteMany({where:{auctionId:{in:ids}}});
    await prisma.walletEntry.deleteMany({where:{userId:{in:userIds}}});
    await prisma.bid.deleteMany({where:{auctionId:{in:ids}}});
    await prisma.auction.deleteMany({where:{id:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:userIds}}});
    await prisma.$disconnect();
    await fs.rm(folder,{recursive:true,force:true});
  }
});
