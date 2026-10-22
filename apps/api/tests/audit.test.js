import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bidDigest, anchorDigest } from '../src/domain/crypto.js';
import { appendAnchor, readAnchors, verifyWithAnchors } from '../src/services/audit.js';

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
