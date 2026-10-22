import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma, serializable } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { wrap } from '../lib/http.js';
import { walletSnapshot } from '../domain/rules.js';

export const walletRoutes = Router();
walletRoutes.use(requireAuth,requireRole('BIDDER'));
walletRoutes.get('/',wrap(async (req,res)=>{
  const user=await prisma.user.findUniqueOrThrow({where:{id:req.user.id}});
  const entries=await prisma.walletEntry.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},take:25});
  res.json({wallet:walletSnapshot(user),entries});
}));
walletRoutes.post('/deposit',rateLimit({windowMs:60_000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),wrap(async(req,res)=>{
  const {amountCents}=z.object({amountCents:z.number().int().min(100).max(5_000_000_00)}).parse(req.body);
  const user=await serializable(async tx=>{
    const updated=await tx.user.update({where:{id:req.user.id},data:{balanceCents:{increment:BigInt(amountCents)}}});
    await tx.walletEntry.create({data:{userId:req.user.id,kind:'DEPOSIT',amountCents:BigInt(amountCents)}});
    return updated;
  });
  res.status(201).json({wallet:walletSnapshot(user)});
}));
