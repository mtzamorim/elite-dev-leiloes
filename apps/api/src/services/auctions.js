import { randomUUID } from 'node:crypto';
import { prisma, serializable, lockAuction, lockUser } from '../lib/db.js';
import { badRequest } from '../lib/http.js';
import { auctionState, extendedDeadline, minimumNextBid, validateBid } from '../domain/rules.js';
import { anonymousBidder, anchorDigest, bidDigest, receiptDigest, validateBidChain } from '../domain/crypto.js';
import { auctionAudit, flushAuditOutbox } from './audit.js';
import { getArtwork } from './artworks.js';
import { cacheClevelandArtworkImage } from './catalogImages.js';

export function auctionView(auction, secret, viewerId = null) {
  return {
    id:auction.id,
    artworkSource:auction.artworkSource || 'ART_INSTITUTE',
    artworkUrl:auction.artworkUrl || `https://www.artic.edu/artworks/${auction.artworkId}`,
    title:auction.title,
    artist:auction.artist,
    imageUrl:auction.imageUrl,
    artworkDate:auction.artworkDate,
    artworkId:auction.artworkId,
    description:auction.description,
    ownerName:auction.owner?.name || 'Leiloeiro',
    initialBidCents:auction.initialBidCents,
    incrementCents:auction.incrementCents,
    currentBidCents:auction.currentBidCents,
    minNextBidCents:minimumNextBid(auction),
    leaderAlias:auction.leaderId ? anonymousBidder(secret,auction.id,auction.leaderId) : null,
    isLeading:viewerId ? auction.leaderId===viewerId && auctionState(auction)==='LIVE' : false,
    isOwner: viewerId ? auction.ownerId===viewerId : false,
    startsAt:auction.startsAt,
    endsAt:auction.endsAt,
    status:auctionState(auction),
    numberOfBids:auction.nextSequence-1,
    receiptId:auction.receipt?.id || null,
    cancellationReason:auction.status==='CANCELED' ? auction.cancellationReason : null,
    createdAt:auction.createdAt
  };
}

export async function createAuction({ownerId,input,notify}) {
  let artwork;
  try { artwork=await getArtwork(input.artworkId, input.artworkSource || 'ART_INSTITUTE'); }
  catch { badRequest('ARTWORK_API_UNAVAILABLE','Não foi possível consultar a obra selecionada no catálogo externo.',503); }
  if(!artwork) badRequest('ARTWORK_NOT_FOUND','Obra não encontrada ou sem imagem pública disponível.',422);
  const startsAt=new Date(input.startsAt);
  const endsAt=new Date(input.endsAt);
  const now=Date.now();
  if(startsAt.getTime() < now-120_000) badRequest('INVALID_DATE','O início não pode estar no passado.',422);
  if(endsAt.getTime() < Math.max(now+300_000, startsAt.getTime()+300_000)) badRequest('INVALID_DATE','O fim deve ser ao menos 5 minutos depois do início e do horário atual.',422);
  if(endsAt.getTime() > startsAt.getTime()+60*24*60*60_000) badRequest('INVALID_DATE','O prazo máximo é de 60 dias.',422);
  const auction=await prisma.auction.create({data:{
    ownerId,...artwork, description:input.description || '',
    initialBidCents:BigInt(input.initialBidCents),incrementCents:BigInt(input.incrementCents),
    startsAt,endsAt,status:startsAt.getTime()<=now?'LIVE':'SCHEDULED'
  }});
  // Store a copy of the selected CC0 image in the persistent storage volume.
  // If the provider is temporarily offline, do not lose the lot: the web client
  // will retry the direct CDN URL and the curator may upload a local copy.
  if (auction.artworkSource === 'CLEVELAND') {
    try { await cacheClevelandArtworkImage(auction.artworkId); }
    catch (error) { console.warn('[Imagem] Não foi possível armazenar cópia local:', error.message); }
  }
  notify?.(auction.id);
  return auction;
}

export async function placeBid({auctionId,userId,amountCents,secret,anchorFile,notify}) {
  const outcome=await serializable(async tx=>{
    await lockAuction(tx,auctionId);
    const auction=await tx.auction.findUnique({where:{id:auctionId}});
    if(!auction) badRequest('NOT_FOUND','Lote não encontrado.',404);
    const history=await tx.bid.findMany({where:{auctionId},orderBy:{sequence:'asc'}});
    const integrity=validateBidChain(secret,auction,history);
    if(!integrity.valid) badRequest('HISTORY_CORRUPTED','Histórico com divergência: lances bloqueados até apuração.',409);
    await lockUser(tx,userId);
    const user=await tx.user.findUnique({where:{id:userId}});
    if(!user) badRequest('AUTH','Usuário não encontrado.',401);
    const now=new Date();
    const amount=validateBid({auction,user,amountCents,now});
    const previous=history.at(-1);
    if(previous && previous.userId === userId) badRequest('ALREADY_LEADING','Você já está ganhando este lote.',409);
    await tx.user.update({where:{id:userId},data:{lockedCents:{increment:amount}}});
    await tx.walletEntry.create({data:{userId,kind:'RESERVE',amountCents:amount,auctionId}});
    if(previous) {
      await lockUser(tx,previous.userId);
      const oldLeader=await tx.user.findUnique({where:{id:previous.userId}});
      if(!oldLeader || oldLeader.lockedCents < previous.amountCents) badRequest('WALLET_INCONSISTENT','Reserva de saldo anterior inconsistente.',409);
      await tx.user.update({where:{id:previous.userId},data:{lockedCents:{decrement:previous.amountCents}}});
      await tx.walletEntry.create({data:{userId:previous.userId,kind:'RELEASE',amountCents:-previous.amountCents,auctionId}});
    }
    const draft={auctionId,sequence:auction.nextSequence,userId,amountCents:amount,createdAt:now,previousHash:auction.chainHead};
    const signature=bidDigest(secret,draft);
    const bid=await tx.bid.create({data:{...draft,signature}});
    // Durável e atômico com o lance: se o processo cair, o cron pode concluir a âncora.
    await tx.auditAnchorOutbox.create({data:{auctionId,sequence:bid.sequence,signature,seal:anchorDigest(secret,bid)}});
    const deadline=extendedDeadline(auction.endsAt,now);
    await tx.auction.update({where:{id:auctionId},data:{
      currentBidCents:amount,leaderId:userId,chainHead:signature,nextSequence:{increment:1},
      endsAt:deadline,status:'LIVE'
    }});
    return {bid,extended:deadline.getTime()>auction.endsAt.getTime()};
  });
  let auditAnchored=true;
  try { await flushAuditOutbox({db:prisma,filename:anchorFile,secret,auctionId}); }
  catch(error) { auditAnchored=false; console.error('[AUDITORIA] Lance aceito, mas âncora externa pendente:',error); }
  notify?.(auctionId);
  return {sequence:outcome.bid.sequence,amountCents:outcome.bid.amountCents,extended:outcome.extended,auditAnchored};
}

export async function cancelAuction({auctionId,ownerId,reason,notify}) {
  const result=await serializable(async tx=>{
    await lockAuction(tx,auctionId);
    const auction=await tx.auction.findUnique({where:{id:auctionId}});
    if(!auction) badRequest('NOT_FOUND','Lote não encontrado.',404);
    if(auction.ownerId!==ownerId) badRequest('FORBIDDEN','Somente o proprietário pode cancelar.',403);
    if(!['SCHEDULED','LIVE'].includes(auctionState(auction))) badRequest('NOT_CANCELABLE','Não é possível cancelar um lote encerrado ou já cancelado.',409);
    const latest=await tx.bid.findFirst({where:{auctionId},orderBy:{sequence:'desc'}});
    if(latest && (!reason || reason.trim().length<10)) badRequest('CANCEL_REASON','Informe um motivo de pelo menos 10 caracteres para cancelar um lote com lances.',422);
    if(latest) {
      await lockUser(tx,latest.userId);
      const leader=await tx.user.findUnique({where:{id:latest.userId}});
      if(!leader || leader.lockedCents < latest.amountCents) badRequest('WALLET_INCONSISTENT','Reserva insuficiente para estorno.',409);
      await tx.user.update({where:{id:latest.userId},data:{lockedCents:{decrement:latest.amountCents}}});
      await tx.walletEntry.create({data:{userId:latest.userId,kind:'RELEASE',amountCents:-latest.amountCents,auctionId}});
    }
    return tx.auction.update({where:{id:auctionId},data:{status:'CANCELED',canceledAt:new Date(),cancellationReason:reason?.trim() || 'Cancelado antes de receber lances.'}});
  });
  notify?.(auctionId);
  return result;
}

export async function settleAuction({auctionId,secret,anchorFile,notify}) {
  try { await flushAuditOutbox({db:prisma,filename:anchorFile,secret,auctionId}); }
  catch(error) { console.error('[AUDITORIA] Reconciliação anterior ao encerramento falhou:',auctionId,error); }
  const outcome=await serializable(async tx=>{
    await lockAuction(tx,auctionId);
    const auction=await tx.auction.findUnique({where:{id:auctionId}});
    if(!auction || auction.status==='CANCELED' || auction.status==='ENDED' || new Date()<auction.endsAt) return null;
    const audit=await auctionAudit(tx,auction,{secret,filename:anchorFile});
    if(audit.status!=='INTEGRO') { console.error(`[ENCERRAMENTO] lote ${auctionId} suspenso por auditoria ${audit.status}: ${audit.reason}`); return null; }
    const highest=await tx.bid.findFirst({where:{auctionId},orderBy:{sequence:'desc'}});
    const finishedAt=new Date();
    if(!highest) {
      await tx.auction.update({where:{id:auctionId},data:{status:'ENDED',finishedAt}});
      return {auctionId,receiptId:null};
    }
    await lockUser(tx,highest.userId);
    const winner=await tx.user.findUnique({where:{id:highest.userId}});
    if(!winner || winner.lockedCents < highest.amountCents || winner.balanceCents < highest.amountCents) {
      throw new Error('Reserva do vencedor inconsistente; encerramento não realizado.');
    }
    await tx.user.update({where:{id:highest.userId},data:{
      balanceCents:{decrement:highest.amountCents}, lockedCents:{decrement:highest.amountCents}
    }});
    await tx.walletEntry.create({data:{userId:highest.userId,auctionId,kind:'SETTLEMENT_DEBIT',amountCents:-highest.amountCents}});
    await lockUser(tx,auction.ownerId);
    await tx.user.update({where:{id:auction.ownerId},data:{balanceCents:{increment:highest.amountCents}}});
    await tx.walletEntry.create({data:{userId:auction.ownerId,auctionId,kind:'SETTLEMENT_CREDIT',amountCents:highest.amountCents}});
    const receipt={id:randomUUID(),auctionId,bidId:highest.id,winnerAlias:anonymousBidder(secret,auctionId,highest.userId),amountCents:highest.amountCents,chainHead:auction.chainHead,createdAt:finishedAt};
    const stored=await tx.receipt.create({data:{...receipt,signature:receiptDigest(secret,receipt)}});
    await tx.auction.update({where:{id:auctionId},data:{status:'ENDED',finishedAt,winnerId:highest.userId}});
    return {auctionId,receiptId:stored.id};
  });
  if(outcome) notify?.(auctionId);
  return outcome;
}
