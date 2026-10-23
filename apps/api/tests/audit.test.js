import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bidDigest, anchorDigest } from '../src/domain/crypto.js';
import { appendAnchor, flushAuditOutbox, readAnchors, verifyWithAnchors } from '../src/services/audit.js';

const secret='secreto-de-teste-bem-diferente-012345';
const createdAt=new Date('2026-10-22T00:00:00Z');
const bid={auctionId:'abc',sequence:1,userId:'foo',amountCents:12000n,createdAt,previousHash:''};
bid.signature=bidDigest(secret,bid);
const auction={id:'abc',nextSequence:2,chainHead:bid.signature,currentBidCents:12000n,leaderId:'foo'};

test('âncora externa registra e detecta exclusão do último lance do DB',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-audit-'));
  const filename=path.join(dir,'audit.ndjson');
  try {
    await appendAnchor(filename,secret,bid);
    const anchors=await readAnchors(filename,'abc');
    assert.equal(anchors.length,1);
    assert.equal(anchors[0].seal,anchorDigest(secret,anchors[0]));
    assert.equal(verifyWithAnchors(secret,auction,[bid],anchors).status,'INTEGRO');
    assert.equal(verifyWithAnchors(secret,{...auction,nextSequence:1,chainHead:'',currentBidCents:null,leaderId:null},[],anchors).status,'ALTERADO');
    assert.equal(verifyWithAnchors(secret,auction,[bid],[]).status,'INDETERMINADO');
    assert.equal(verifyWithAnchors(secret,auction,[bid],[{...anchors[0],seal:'0'.repeat(64)}]).status,'ALTERADO');
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});


test('outbox mantém o lance pendente após falha de arquivo e recupera sem duplicar',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-outbox-'));
  const goodFile=path.join(dir,'audit.ndjson');
  const row={auctionId:bid.auctionId,sequence:bid.sequence,signature:bid.signature,seal:anchorDigest(secret,bid),syncedAt:null,createdAt:new Date()};
  let failAcknowledgment=false;
  const db={
    auditAnchorOutbox:{
      findMany:async()=>row.syncedAt?[]:[row],
      updateMany:async()=>{
        if(failAcknowledgment) {failAcknowledgment=false;throw new Error('Ack falhou após fsync');}
        row.syncedAt=new Date();return {count:1};
      }
    },
    bid:{findUnique:async()=>bid}
  };
  try {
    // Tentar gravar em um diretório, não em um arquivo, falha sem descartar a outbox.
    await assert.rejects(()=>flushAuditOutbox({db,secret,filename:dir}),/EISDIR|illegal operation/i);
    assert.equal(row.syncedAt,null);
    failAcknowledgment=true;
    await assert.rejects(()=>flushAuditOutbox({db,secret,filename:goodFile}),/Ack falhou/);
    assert.equal((await readAnchors(goodFile,bid.auctionId)).length,1);
    assert.equal(row.syncedAt,null);
    assert.equal(await flushAuditOutbox({db,secret,filename:goodFile}),1);
    assert.ok(row.syncedAt);
    assert.equal((await readAnchors(goodFile,bid.auctionId)).length,1,'reconciliação idempotente');
    assert.equal((await flushAuditOutbox({db,secret,filename:goodFile})),0);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('outbox adulterada não é assinada novamente nem exportada para o arquivo',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-outbox-tampered-'));
  const filename=path.join(dir,'audit.ndjson');
  const row={auctionId:bid.auctionId,sequence:bid.sequence,signature:'0'.repeat(64),seal:anchorDigest(secret,bid),syncedAt:null};
  const db={auditAnchorOutbox:{findMany:async()=>[row]},bid:{findUnique:async()=>bid}};
  try {
    await assert.rejects(()=>flushAuditOutbox({db,secret,filename}),/assinatura inválida/);
    assert.equal((await readAnchors(filename,bid.auctionId)).length,0);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
