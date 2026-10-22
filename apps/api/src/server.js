import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { prisma } from './lib/db.js';
import { assertConfiguration,env } from './lib/env.js';
import { optionalAuth,tokenUser } from './lib/auth.js';
import { DomainError } from './domain/rules.js';
import { errorHandler,wrap } from './lib/http.js';
import { authRoutes } from './routes/auth.js';
import { walletRoutes } from './routes/wallet.js';
import { artworkRoutes } from './routes/artworks.js';
import { makeAuctionRoutes } from './routes/auctions.js';
import { makeAuditRoutes } from './routes/audit.js';
import { makeUserRoutes } from './routes/users.js';
import { settleAuction } from './services/auctions.js';

assertConfiguration();
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',process.env.TRUST_PROXY === 'true' ? 1 : false);
app.set('json replacer',(_key,value)=>typeof value==='bigint' ? String(value) : value);
app.use(helmet({contentSecurityPolicy:{directives:{
  defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],
  imgSrc:["'self'",'data:','https://www.artic.edu'],connectSrc:["'self'",'ws:','wss:'],
  fontSrc:["'self'",'data:','https://fonts.gstatic.com'],objectSrc:["'none'"]
}}}));
app.use(express.json({limit:'32kb'}));
app.use(cookieParser());
app.use('/api', (req,_res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin=req.get('origin');
    const hostname=(process.env.TRUST_PROXY === 'true' ? req.get('x-forwarded-host') : null) || req.get('host');
    let allowedOrigin=false;
    try { allowedOrigin=Boolean(origin && new URL(origin).host===hostname); } catch { /* rejeitado abaixo */ }
    const devOrigin=!env.production && origin && /^http:\/\/localhost:5173$/.test(origin);
    if((origin && !allowedOrigin && !devOrigin) || req.get('sec-fetch-site')==='cross-site') {
      return next(new DomainError('CSRF','Origem não autorizada.',403));
    }
  }
  next();
});
app.use('/api',rateLimit({windowMs:60_000,limit:180,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api',optionalAuth);

const server=http.createServer(app);
const io=new SocketServer(server,{path:'/socket.io',cors:{origin:false}});
io.use((socket,next)=>{
  const raw=socket.handshake.headers.cookie || '';
  const token=raw.split(';').map(t=>t.trim()).find(t=>t.startsWith('atelier_session='))?.split('=')[1];
  try {socket.data.userId=token ? tokenUser(decodeURIComponent(token)) : null;}catch{socket.data.userId=null;}
  next();
});
io.on('connection',socket=>{
  if(socket.data.userId) socket.join(`user:${socket.data.userId}`);
  socket.on('auction:join',id=>{
    if(typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id)) socket.join(`auction:${id}`);
  });
  socket.on('auction:leave',id=>{ if(typeof id==='string') socket.leave(`auction:${id}`); });
});
const notify=(id)=>{
  io.emit('auctions:changed',{id});
  io.to(`auction:${id}`).emit('auction:changed',{id});
};

app.get('/api/health',wrap(async(_req,res)=>{
  await prisma.$queryRaw`SELECT 1`;
  res.json({status:'ok',serverTime:new Date(),api:'1.0.0'});
}));
app.use('/api/auth',authRoutes);
app.use('/api/wallet',walletRoutes);
app.use('/api/artworks',artworkRoutes);
app.use('/api/auctions',makeAuctionRoutes({secret:env.auditSecret,anchorFile:env.anchorFile,notify}));
app.use('/api/me',makeUserRoutes(env.auditSecret));
app.use('/api/audit',makeAuditRoutes({secret:env.auditSecret,anchorFile:env.anchorFile}));
app.use('/api',(_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Rota não encontrada.'}}));

const webDist=fileURLToPath(new URL('../../web/dist/',import.meta.url));
if(fs.existsSync(path.join(webDist,'index.html'))) {
  app.use(express.static(webDist,{index:false,maxAge:'1h'}));
  app.get('*',(_req,res)=>res.sendFile(path.join(webDist,'index.html')));
}
app.use(errorHandler);

let busy=false;
async function tick() {
  if(busy) return;
  busy=true;
  try {
    const now=new Date();
    await prisma.auction.updateMany({where:{status:'SCHEDULED',startsAt:{lte:now},endsAt:{gt:now}},data:{status:'LIVE'}});
    const ended=await prisma.auction.findMany({where:{status:{in:['SCHEDULED','LIVE']},endsAt:{lte:now}},select:{id:true},orderBy:{endsAt:'asc'},take:40});
    for(const auction of ended) {
      try { await settleAuction({auctionId:auction.id,secret:env.auditSecret,anchorFile:env.anchorFile,notify}); }
      catch(error) { console.error('[scheduler]',auction.id,error); }
    }
  } catch(error) { console.error('[scheduler]',error); }
  finally { busy=false; }
}

const interval=setInterval(tick,5000);
server.listen(env.port,()=>{
  console.info(`Ateliê API escutando em :${env.port}`);
  void tick();
});
async function shutdown() {
  clearInterval(interval);
  await new Promise(resolve=>server.close(resolve));
  io.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT',()=>{void shutdown();});
process.on('SIGTERM',()=>{void shutdown();});
