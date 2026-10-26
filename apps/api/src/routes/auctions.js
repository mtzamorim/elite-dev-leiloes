import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma, serializable, lockAuction } from '../lib/db.js';
import { requireAuth,requireRole } from '../lib/auth.js';
import { badRequest,wrap } from '../lib/http.js';
import { anonymousBidder } from '../domain/crypto.js';
import { auctionView,cancelAuction,createAuction,placeBid } from '../services/auctions.js';
import { auctionState } from '../domain/rules.js';
import { MAX_IMAGE_BYTES, saveLotImage, discardLotImage, removePreviousLotImage } from '../services/lotImages.js';

const uuid=z.string().uuid();
const auctionInput=z.object({
  artworkId:z.number().int().positive(),
  artworkSource:z.enum(['ART_INSTITUTE','CLEVELAND']).optional().default('ART_INSTITUTE'),
  description:z.string().max(1200).optional().default(''),
  initialBidCents:z.number().int().min(100).max(100_000_000_00),
  incrementCents:z.number().int().min(100).max(10_000_000_00),
  startsAt:z.string().datetime({offset:true}),
  endsAt:z.string().datetime({offset:true})
});
const include={owner:{select:{name:true}},receipt:{select:{id:true}}};

export function makeAuctionRoutes({secret,anchorFile,notify}) {
  const routes=Router();
  routes.get('/',wrap(async(req,res)=>{
    const {q,status,page}=z.object({
      q:z.string().trim().max(80).optional().default(''),
      status:z.enum(['LIVE','SCHEDULED','ENDED','ALL']).optional().default('ALL'),
      page:z.coerce.number().int().min(1).max(10000).optional().default(1)
    }).parse(req.query);
    const now=new Date();
    const where={ status:{not:'CANCELED'} };
    if(q) where.OR=[{title:{contains:q,mode:'insensitive'}},{artist:{contains:q,mode:'insensitive'}}];
    if(status==='LIVE') { where.status={in:['SCHEDULED','LIVE']};where.startsAt={lte:now};where.endsAt={gt:now}; }
    if(status==='SCHEDULED') { where.status={in:['SCHEDULED','LIVE']};where.startsAt={gt:now}; }
    if(status==='ENDED') where.AND=[{OR:[{status:'ENDED'},{endsAt:{lte:now}}]}];
    const [items,total]=await prisma.$transaction([
      prisma.auction.findMany({where,include,orderBy:[{createdAt:'desc'}],skip:(page-1)*12,take:12}),
      prisma.auction.count({where})
    ]);
    res.json({items:items.map(a=>auctionView(a,secret,req.user?.id)),total,page,pageSize:12,serverTime:now});
  }));
  routes.get('/mine',requireAuth,requireRole('AUCTIONEER'),wrap(async(req,res)=>{
    const items=await prisma.auction.findMany({where:{ownerId:req.user.id},include,orderBy:{createdAt:'desc'},take:100});
    res.json({items:items.map(a=>auctionView(a,secret,req.user.id))});
  }));
  routes.post('/',requireAuth,requireRole('AUCTIONEER'),wrap(async(req,res)=>{
    const input=auctionInput.parse(req.body);
    const auction=await createAuction({ownerId:req.user.id,input,notify});
    const stored=await prisma.auction.findUniqueOrThrow({where:{id:auction.id},include});
    res.status(201).json({auction:auctionView(stored,secret,req.user.id)});
  }));
  // Uma imagem licenciada pelo curador e guardada no volume local substitui
  // a URL IIIF indisponivel. A alteracao e permitida apenas SEM lances.
  routes.put('/:id/image', requireAuth, requireRole('AUCTIONEER'),
    rateLimit({windowMs:60_000,limit:8,standardHeaders:'draft-7',legacyHeaders:false}),
    express.raw({type:'image/*',limit:MAX_IMAGE_BYTES}), wrap(async(req,res)=>{
      const id=uuid.parse(req.params.id);
      const existing=await prisma.auction.findUnique({where:{id},select:{ownerId:true}});
      if(!existing)badRequest('NOT_FOUND','Lote nao encontrado.',404);
      if(existing.ownerId!==req.user.id)badRequest('FORBIDDEN','Somente o proprietario pode enviar a reproducao.',403);
      let saved;
      try {
        try { saved=await saveLotImage({auctionId:id,bytes:req.body,contentType:req.get('content-type')}); }
        catch(error){ badRequest('INVALID_IMAGE',error.message,422); }
        const oldUrl=await serializable(async tx=>{
          await lockAuction(tx,id);
          const auction=await tx.auction.findUniqueOrThrow({where:{id}});
          if(auction.ownerId!==req.user.id)badRequest('FORBIDDEN','Lote de outro leiloeiro.',403);
          if(!['SCHEDULED','LIVE'].includes(auctionState(auction)) || auction.nextSequence!==1) {
            badRequest('IMAGE_LOCKED','A imagem so pode ser alterada em lotes nao encerrados e sem lances.',409);
          }
          await tx.auction.update({where:{id},data:{imageUrl:saved.url}});
          return auction.imageUrl;
        });
        // Nao falhar uma alteracao ja confirmada no banco por limpeza de arquivos.
        try { await removePreviousLotImage(oldUrl,id); }
        catch(error){ console.warn('[Imagem] Imagem anterior nao removida:',error.message); }
        notify?.(id);
        res.json({imageUrl:saved.url});
      }catch(error){
        if(saved)await discardLotImage(saved.filepath).catch(()=>{});
        throw error;
      }
    }));

  routes.get('/:id',wrap(async(req,res)=>{
    const id=uuid.parse(req.params.id);
    const auction=await prisma.auction.findUnique({where:{id},include});
    if(!auction) badRequest('NOT_FOUND','Lote não encontrado.',404);
    const participation = req.user?.role==='BIDDER'
      ? await prisma.bid.findFirst({where:{auctionId:id,userId:req.user.id},select:{id:true}})
      : null;
    res.json({auction:{...auctionView(auction,secret,req.user?.id),hasParticipated:Boolean(participation)},serverTime:new Date()});
  }));
  routes.get('/:id/bids',wrap(async(req,res)=>{
    const id=uuid.parse(req.params.id);
    const exists=await prisma.auction.findUnique({where:{id},select:{id:true}});
    if(!exists) badRequest('NOT_FOUND','Lote não encontrado.',404);
    const bids=await prisma.bid.findMany({where:{auctionId:id},orderBy:{sequence:'desc'},take:500});
    res.json({items:bids.map(b=>({id:b.id,sequence:b.sequence,alias:anonymousBidder(secret,id,b.userId),amountCents:b.amountCents,createdAt:b.createdAt,signature:b.signature}))});
  }));
  routes.post('/:id/bids',requireAuth,requireRole('BIDDER'),wrap(async(req,res)=>{
    const auctionId=uuid.parse(req.params.id);
    const {amountCents}=z.object({amountCents:z.number().int().min(100).max(100_000_000_00)}).parse(req.body);
    const result=await placeBid({auctionId,userId:req.user.id,amountCents,secret,anchorFile,notify});
    res.status(201).json(result);
  }));
  routes.post('/:id/cancel',requireAuth,requireRole('AUCTIONEER'),wrap(async(req,res)=>{
    const auctionId=uuid.parse(req.params.id);
    const {reason}=z.object({reason:z.string().max(500).optional()}).parse(req.body);
    await cancelAuction({auctionId,ownerId:req.user.id,reason,notify});
    res.json({ok:true});
  }));
  return routes;
}
