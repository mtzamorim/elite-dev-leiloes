import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { badRequest, wrap } from '../lib/http.js';
import { setSession, clearSession, userSafe } from '../lib/auth.js';

export const authRoutes = Router();
const loginLimiter = rateLimit({ windowMs: 15*60*1000, limit:20, standardHeaders:'draft-7', legacyHeaders:false });
const credentials = z.object({ email:z.string().trim().email().max(255).toLowerCase(), password:z.string().min(8).max(120) });
const register = credentials.extend({name:z.string().trim().min(2).max(120),role:z.enum(['AUCTIONEER','BIDDER'])});

authRoutes.get('/me', (req,res)=>res.json({user:userSafe(req.user)}));
authRoutes.post('/register', loginLimiter, wrap(async(req,res)=>{
  const input = register.parse(req.body);
  const existing = await prisma.user.findUnique({where:{email:input.email}});
  if (existing) badRequest('EMAIL_EXISTS','E-mail já cadastrado.',409);
  const user = await prisma.user.create({data:{name:input.name,email:input.email,role:input.role,passwordHash:await bcrypt.hash(input.password,12)}});
  setSession(res,user);
  res.status(201).json({user:userSafe(user)});
}));
authRoutes.post('/login', loginLimiter, wrap(async(req,res)=>{
  const input = credentials.parse(req.body);
  const user = await prisma.user.findUnique({where:{email:input.email}});
  if (!user || !(await bcrypt.compare(input.password,user.passwordHash))) badRequest('INVALID_CREDENTIALS','E-mail ou senha inválidos.',401);
  setSession(res,user);
  res.json({user:userSafe(user)});
}));
authRoutes.post('/logout',(_req,res)=>{ clearSession(res); res.json({ok:true}); });
