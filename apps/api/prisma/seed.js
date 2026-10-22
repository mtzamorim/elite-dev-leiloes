import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db.js';
import { env,assertConfiguration } from '../src/lib/env.js';
import { getArtwork } from '../src/services/artworks.js';
import { placeBid,settleAuction } from '../src/services/auctions.js';

assertConfiguration();
if(process.env.DEMO_SEED !== 'true') {
  console.info('Seed desabilitada: defina DEMO_SEED=true para carregar dados fictícios.');
  process.exit(0);
}

const fallbackImage='https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg';
const snapshot=[
  {artworkId:27992,title:'A Sunday on La Grande Jatte — 1884',artist:'Georges Seurat',artworkDate:'1884–1886',imageUrl:fallbackImage},
  {artworkId:28560,title:'The Bedroom',artist:'Vincent van Gogh',artworkDate:'1889',imageUrl:''}
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

try {
  const existing=await prisma.auction.count();
  if(existing) {
    console.info(`Já existem ${existing} lotes. Seed de leilões ignorada para não repetir dados.`);
  } else {
    const hash=await bcrypt.hash('Teste@12345',12);
    const [seller,ana,bruno]=await Promise.all([
      user('Curadoria Ateliê','leiloeiro@demo.com','AUCTIONEER',hash),
      user('Ana Cliente','ana@demo.com','BIDDER',hash,1_500_000n),
      user('Bruno Cliente','bruno@demo.com','BIDDER',hash,1_500_000n)
    ]);
    const live=await lot(seller.id,0,-30,45,300_000,25_000,'Obra histórica selecionada da coleção pública. Lances acompanhados em tempo real.');
    const closed=await lot(seller.id,1,-150,10,200_000,20_000,'Uma obra marcante do pós-impressionismo, com registro público de proveniência.');
    await lot(seller.id,1,120,480,180_000,10_000,'Leilão programado para as próximas horas.');
    await lot(seller.id,0,-10,90,450_000,30_000,'Um segundo lote aberto para novos licitantes.');
    for(const [auctionId,userId,amountCents] of [
      [live.id,ana.id,300_000],[live.id,bruno.id,325_000],
      [closed.id,bruno.id,200_000],[closed.id,ana.id,220_000]
    ]) {
      await placeBid({auctionId,userId,amountCents,secret:env.auditSecret,anchorFile:env.anchorFile});
    }
    await prisma.auction.update({where:{id:closed.id},data:{endsAt:new Date(Date.now()-2000)}});
    await settleAuction({auctionId:closed.id,secret:env.auditSecret,anchorFile:env.anchorFile});
    console.info('Seed aplicada: 1 leiloeiro, 2 clientes, 4 lotes, lances ao vivo e um comprovante.');
  }
} finally { await prisma.$disconnect(); }
