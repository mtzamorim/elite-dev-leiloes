import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db.js';
import { env, assertConfiguration } from '../src/lib/env.js';
import { getArtwork } from '../src/services/artworks.js';
import { placeBid, settleAuction } from '../src/services/auctions.js';

assertConfiguration();
if (process.env.DEMO_SEED !== 'true') {
  console.info('Seed desabilitada: defina DEMO_SEED=true para carregar dados fictícios.');
  process.exit(0);
}

const fallbackImage='https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg';
const snapshot=[
  {artworkId:27992,title:'A Sunday on La Grande Jatte — 1884',artist:'Georges Seurat',artworkDate:'1884–1886',imageUrl:fallbackImage},
  {artworkId:28560,title:'The Bedroom',artist:'Vincent van Gogh',artworkDate:'1889',imageUrl:fallbackImage}
];

async function seededArtwork(index) {
  const defaults=snapshot[index%snapshot.length];
  try { return await getArtwork(defaults.artworkId) || defaults; }
  catch { console.warn(`Catálogo externo indisponível; utilizando snapshot local do item ${defaults.artworkId}.`); return defaults; }
}
async function user(name,email,role,passwordHash,balanceCents=0n) {
  return prisma.user.upsert({where:{email},update:{},create:{name,email,role,passwordHash,balanceCents}});
}
function minutes(n) { return new Date(Date.now()+n*60_000); }
async function lot(ownerId,item,startsIn,endsIn,initial,increment,description) {
  const artwork=await seededArtwork(item);
  return prisma.auction.create({data:{ownerId,...artwork,startsAt:minutes(startsIn),endsAt:minutes(endsIn),initialBidCents:BigInt(initial),incrementCents:BigInt(increment),description,status:startsIn<=0?'LIVE':'SCHEDULED'}});
}
// Recarrega apenas o saldo de demonstracao, sem sobrescrever historico nem reservas.
async function ensureDemoFunds(userId,minAvailable=1_000_000n) {
  await prisma.$transaction(async tx=>{
    const current=await tx.user.findUniqueOrThrow({where:{id:userId}});
    const shortfall=minAvailable-(current.balanceCents-current.lockedCents);
    if(shortfall<=0n) return;
    await tx.user.update({where:{id:userId},data:{balanceCents:{increment:shortfall}}});
    await tx.walletEntry.create({data:{userId,kind:'DEPOSIT',amountCents:shortfall}});
  });
}

try {
  const hash=await bcrypt.hash('Teste@12345',12);
  const [seller,ana,bruno]=await Promise.all([
    user('Curadoria Ateliê','leiloeiro@demo.com','AUCTIONEER',hash),
    user('Ana Cliente','ana@demo.com','BIDDER',hash,1_500_000n),
    user('Bruno Cliente','bruno@demo.com','BIDDER',hash,1_500_000n)
  ]);
  await ensureDemoFunds(ana.id);
  await ensureDemoFunds(bruno.id);

  // Rerodar o seed nao altera lances antigos nem cria duplicatas quando ha lotes ativos.
  // Um novo lote e criado somente quando nao existe vitrine demo com pelo menos 2 h restantes.
  const now=new Date();
  const safeDeadline=new Date(now.getTime()+2*60*60_000);
  const liveFilter={ownerId:seller.id,status:{in:['LIVE','SCHEDULED']},startsAt:{lte:now},endsAt:{gt:safeDeadline}};
  const liveWithBids=await prisma.auction.findFirst({where:{...liveFilter,bids:{some:{}}},select:{id:true}});
  if(!liveWithBids) {
    const live=await lot(seller.id,0,-30,14*24*60,300_000,25_000,'Obra histórica selecionada da coleção pública. Lances acompanhados em tempo real.');
    await placeBid({auctionId:live.id,userId:ana.id,amountCents:300_000,secret:env.auditSecret,anchorFile:env.anchorFile});
    await placeBid({auctionId:live.id,userId:bruno.id,amountCents:325_000,secret:env.auditSecret,anchorFile:env.anchorFile});
    console.info('Seed: novo lote demonstrativo ao vivo com lances (14 dias de duração).');
  }
  const liveCount=await prisma.auction.count({where:liveFilter});
  if(liveCount<2) {
    await lot(seller.id,0,-10,20*24*60,450_000,30_000,'Segundo lote de demonstração aberto a novos licitantes.');
  }
  const scheduled=await prisma.auction.count({where:{ownerId:seller.id,status:'SCHEDULED',startsAt:{gt:now}}});
  if(!scheduled) await lot(seller.id,1,120,24*60,180_000,10_000,'Leilão programado para as próximas horas.');

  const hasReceipt=await prisma.receipt.count({where:{auction:{ownerId:seller.id}}});
  if(!hasReceipt) {
    const closed=await lot(seller.id,1,-150,10,200_000,20_000,'Obra pós-impressionista com arremate e comprovante de demonstração.');
    await placeBid({auctionId:closed.id,userId:bruno.id,amountCents:200_000,secret:env.auditSecret,anchorFile:env.anchorFile});
    await placeBid({auctionId:closed.id,userId:ana.id,amountCents:220_000,secret:env.auditSecret,anchorFile:env.anchorFile});
    await prisma.auction.update({where:{id:closed.id},data:{endsAt:new Date(Date.now()-2000)}});
    await settleAuction({auctionId:closed.id,secret:env.auditSecret,anchorFile:env.anchorFile});
    console.info('Seed: arremate encerrado e comprovante demonstrativo criados.');
  }
  console.info('Seed de demonstração verificada: 1 leiloeiro, 2 licitantes e lotes disponíveis; rode novamente quando necessário.');
} finally { await prisma.$disconnect(); }
