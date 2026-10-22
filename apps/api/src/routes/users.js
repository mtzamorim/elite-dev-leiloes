import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { requireAuth,requireRole } from '../lib/auth.js';
import { wrap } from '../lib/http.js';
import { auctionView } from '../services/auctions.js';

export function makeUserRoutes(secret) {
  const routes=Router();
  routes.use(requireAuth,requireRole('BIDDER'));
  routes.get('/bids',wrap(async(req,res)=>{
    const bids=await prisma.bid.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},include:{auction:{include:{owner:{select:{name:true}},receipt:{select:{id:true}}}}},take:250});
    const unique=new Map();
    for(const bid of bids) {
      if(!unique.has(bid.auctionId)) unique.set(bid.auctionId,{auction:auctionView(bid.auction,secret,req.user.id),myLastBidCents:bid.amountCents,myLastBidAt:bid.createdAt});
    }
    res.json({items:[...unique.values()]});
  }));
  routes.get('/wins',wrap(async(req,res)=>{
    const auctions=await prisma.auction.findMany({where:{winnerId:req.user.id,status:'ENDED'},orderBy:{finishedAt:'desc'},include:{owner:{select:{name:true}},receipt:{select:{id:true}}},take:100});
    res.json({items:auctions.map(a=>auctionView(a,secret,req.user.id))});
  }));
  return routes;
}
