import fs from 'node:fs/promises';
import path from 'node:path';
import { anchorDigest, bidDigest, equalDigest, receiptDigest, validateBidChain } from '../domain/crypto.js';

/** Apêndice idempotente: crash após fsync e antes do ACK não duplica âncoras. */
export async function appendAnchor(filename, secret, bid) {
  const entry = {auctionId:bid.auctionId, sequence:bid.sequence, signature:bid.signature};
  entry.seal = anchorDigest(secret,entry);
  const existing=(await readAnchors(filename,entry.auctionId)).filter(a=>a.sequence===entry.sequence);
  if(existing.length) {
    if(existing.length!==1 || !equalDigest(existing[0].seal,entry.seal) ||
       !equalDigest(existing[0].signature,entry.signature)) {
      throw new Error(`Âncora externa conflitante ou duplicada no lance ${entry.sequence}.`);
    }
    return false;
  }
  await fs.mkdir(path.dirname(filename),{recursive:true});
  // Apenas uma instância escreve neste volume; o reconciliador serializa escritas no processo.
  const file = await fs.open(filename,'a',0o600);
  try {
    await file.writeFile(`${JSON.stringify(entry)}\n`);
    await file.sync();
  } finally { await file.close(); }
  return true;
}

export async function readAnchors(filename, auctionId) {
  let contents;
  try { contents = await fs.readFile(filename,'utf8'); }
  catch(error) { if(error?.code === 'ENOENT') return []; throw error; }
  const lines=contents.split('\n').filter(Boolean);
  if(lines.length > 100_000) throw new Error('Arquivo de auditoria excedeu o limite de leitura.');
  const result=[];
  for(const line of lines) {
    try {
      const anchor=JSON.parse(line);
      if(anchor.auctionId===auctionId) result.push(anchor);
    } catch { throw new Error('Arquivo externo de âncoras inválido.'); }
  }
  return result;
}

// Serializa os flushes, inclusive se o cron e várias requisições ocorrerem juntos.
let flushing=Promise.resolve();
export function flushAuditOutbox({db,secret,filename,auctionId,limit=100}) {
  const task=flushing.then(async()=>{
    const pending=await db.auditAnchorOutbox.findMany({
      where:{syncedAt:null,...(auctionId?{auctionId}:{})},
      orderBy:[{createdAt:'asc'},{sequence:'asc'}],take:limit
    });
    let synced=0;
    for(const entry of pending) {
      if(!equalDigest(entry.seal,anchorDigest(secret,entry))) {
        throw new Error(`Registro de outbox com assinatura inválida: ${entry.auctionId}/${entry.sequence}`);
      }
      const bid=await db.bid.findUnique({where:{auctionId_sequence:{auctionId:entry.auctionId,sequence:entry.sequence}}});
      if(!bid || !equalDigest(bid.signature,entry.signature) || !equalDigest(bid.signature,bidDigest(secret,bid))) {
        throw new Error(`Lance original diverge da outbox: ${entry.auctionId}/${entry.sequence}`);
      }
      await appendAnchor(filename,secret,entry);
      await db.auditAnchorOutbox.updateMany({
        where:{auctionId:entry.auctionId,sequence:entry.sequence,syncedAt:null,signature:entry.signature},
        data:{syncedAt:new Date()}
      });
      synced++;
    }
    return synced;
  });
  flushing=task.catch(()=>{});
  return task;
}

export function verifyWithAnchors(secret, auction, bids, anchors) {
  const chain=validateBidChain(secret,auction,bids);
  if(!chain.valid) return {status:'ALTERADO',reason:chain.reason};
  const map=new Map();
  for(const anchor of anchors) {
    if(!equalDigest(anchor.seal,anchorDigest(secret,anchor)) || map.has(anchor.sequence)) {
      return {status:'ALTERADO',reason:'Âncora externa inválida ou duplicada.'};
    }
    map.set(anchor.sequence,anchor.signature);
  }
  // Valida os registros existentes ANTES de sinalizar pendências de escrita.
  // Uma âncora falsa não pode ser disfarçada por outras ainda pendentes.
  for(const bid of bids) {
    const signature=map.get(bid.sequence);
    if(signature && !equalDigest(signature,bid.signature)) {
      return {status:'ALTERADO',reason:`Âncora do lance ${bid.sequence} diverge do registro.`};
    }
  }
  if(anchors.length>bids.length || [...map.keys()].some(sequence=>!bids.some(b=>b.sequence===sequence))) {
    return {status:'ALTERADO',reason:'Existe(m) âncora(s) de lance(s) não encontrado(s) no banco de dados.'};
  }
  if(anchors.length<bids.length) return {status:'INDETERMINADO',reason:'Faltam âncoras externas para comprovar a integridade completa.'};
  return {status:'INTEGRO',reason:'Assinaturas, ordem e âncoras externas conferem.'};
}

export async function auctionAudit(db, auction, {secret,filename}) {
  const bids=await db.bid.findMany({where:{auctionId:auction.id},orderBy:{sequence:'asc'}});
  try {
    const anchors=await readAnchors(filename,auction.id);
    return { ...verifyWithAnchors(secret,auction,bids,anchors), bidCount:bids.length, anchorCount:anchors.length, head:auction.chainHead };
  } catch(error) {
    return {status:'INDETERMINADO',reason:`Não foi possível ler a âncora externa: ${error.message}`,bidCount:bids.length,anchorCount:null,head:auction.chainHead};
  }
}

export function verifyReceipt(secret,receipt) {
  return equalDigest(receipt.signature,receiptDigest(secret,receipt));
}
