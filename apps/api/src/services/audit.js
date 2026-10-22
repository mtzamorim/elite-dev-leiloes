import fs from 'node:fs/promises';
import path from 'node:path';
import { anchorDigest, bidDigest, equalDigest, receiptDigest, validateBidChain } from '../domain/crypto.js';

export async function appendAnchor(filename, secret, bid) {
  const entry = { auctionId:bid.auctionId, sequence:bid.sequence, signature:bid.signature };
  entry.seal = anchorDigest(secret,entry);
  await fs.mkdir(path.dirname(filename),{recursive:true});
  // append + fsync; volumes persistentes devem ser montados em produção.
  const file = await fs.open(filename, 'a', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(entry)}\n`);
    await file.sync();
  } finally { await file.close(); }
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

export function verifyWithAnchors(secret, auction, bids, anchors) {
  const chain=validateBidChain(secret,auction,bids);
  if(!chain.valid) return {status:'ALTERADO',reason:chain.reason};
  if(anchors.length < bids.length) return {status:'INDETERMINADO', reason:'Faltam âncoras externas para comprovar a integridade completa.'};
  if(anchors.length > bids.length) return {status:'ALTERADO',reason:'Existe(m) âncora(s) de lance(s) não encontrado(s) no banco de dados.'};
  const map=new Map();
  for(const anchor of anchors) {
    if(!equalDigest(anchor.seal,anchorDigest(secret,anchor)) || map.has(anchor.sequence)) {
      return {status:'ALTERADO',reason:'Âncora externa inválida ou duplicada.'};
    }
    map.set(anchor.sequence,anchor.signature);
  }
  for(const bid of bids) {
    if(!equalDigest(map.get(bid.sequence),bid.signature)) {
      return {status:'ALTERADO',reason:`Âncora do lance ${bid.sequence} diverge do registro.`};
    }
  }
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
