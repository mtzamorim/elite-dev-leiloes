import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { badRequest,wrap } from '../lib/http.js';
import { anonymousBidder } from '../domain/crypto.js';
import { auctionAudit,verifyReceipt } from '../services/audit.js';
import { auctionView } from '../services/auctions.js';

export function makeAuditRoutes({secret,anchorFile}) {
  const routes=Router();
  routes.get('/auctions/:id',wrap(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id);
    const auction=await prisma.auction.findUnique({where:{id},include:{owner:{select:{name:true}},receipt:{select:{id:true}}}});
    if(!auction) badRequest('NOT_FOUND','Lote não encontrado.',404);
    const [audit,bids]=await Promise.all([
      auctionAudit(prisma,auction,{secret,filename:anchorFile}),
      prisma.bid.findMany({where:{auctionId:id},orderBy:{sequence:'asc'}})
    ]);
    res.json({audit,auction:auctionView(auction,secret),bids:bids.map(b=>({sequence:b.sequence,alias:anonymousBidder(secret,id,b.userId),amountCents:b.amountCents,createdAt:b.createdAt,signature:b.signature,previousHash:b.previousHash}))});
  }));
  routes.get('/receipts/:id',wrap(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id);
    const receipt=await prisma.receipt.findUnique({where:{id},include:{auction:{include:{owner:{select:{name:true}},receipt:{select:{id:true}}}}}});
    if(!receipt) badRequest('NOT_FOUND','Comprovante não encontrado.',404);
    const audit=await auctionAudit(prisma,receipt.auction,{secret,filename:anchorFile});
    const lastBid=await prisma.bid.findFirst({where:{auctionId:receipt.auctionId},orderBy:{sequence:'desc'},select:{id:true}});
    const valid=verifyReceipt(secret,receipt) && audit.status==='INTEGRO' && receipt.auction.status==='ENDED' &&
      receipt.auction.chainHead===receipt.chainHead && lastBid?.id===receipt.bidId &&
      String(receipt.auction.currentBidCents)===String(receipt.amountCents) &&
      receipt.auction.winnerId!==null && anonymousBidder(secret,receipt.auctionId,receipt.auction.winnerId)===receipt.winnerAlias;
    res.json({receipt:{id:receipt.id,auctionId:receipt.auctionId,winningBidId:receipt.bidId,winnerAlias:receipt.winnerAlias,amountCents:receipt.amountCents,createdAt:receipt.createdAt,signature:receipt.signature,lot:auctionView(receipt.auction,secret)},valid,auditStatus:audit.status});
  }));
  return routes;
}
