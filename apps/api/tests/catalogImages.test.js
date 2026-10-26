import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cacheClevelandArtworkImage } from '../src/services/catalogImages.js';

const goodJpeg = Buffer.from([0xff,0xd8,0xff,0xe0,0,0x10,0x4a,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0]);
const cdn = (id) => `https://openaccess-cdn.clevelandart.org/test/${id}.jpg`;
function detail(id,url=cdn(id)){
  return {data:{id,title:'Cached artwork',share_license_status:'CC0',images:{web:{url}},creators:[{description:'Example artist'}]}};
}

test('Cleveland public image is validated, cached and served locally on the next request',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-cma-cache-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  let meta=0,images=0;
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    if(url.hostname==='openaccess-api.clevelandart.org') {meta++;return new Response(JSON.stringify(detail(900015)),{headers:{'Content-Type':'application/json'}});}
    assert.equal(url.hostname,'openaccess-cdn.clevelandart.org');
    images++;
    return new Response(goodJpeg,{headers:{'Content-Type':'image/jpeg'}});
  });
  const first=await cacheClevelandArtworkImage(900015,{directory});
  assert.equal(first.contentType,'image/jpeg');
  assert.deepEqual(first.bytes,goodJpeg);
  const second=await cacheClevelandArtworkImage(900015,{directory});
  assert.deepEqual(second.bytes,goodJpeg);
  assert.equal(meta,1);
  assert.equal(images,1);
  assert.deepEqual(await fs.readFile(path.join(directory,'900015.jpg')),goodJpeg);
});

test('Image cache rejects invalid image content and does not store it',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-cma-invalid-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    if(url.hostname==='openaccess-api.clevelandart.org') return new Response(JSON.stringify(detail(900016)),{headers:{'Content-Type':'application/json'}});
    return new Response('some-not-image-contents',{headers:{'Content-Type':'text/html'}});
  });
  await assert.rejects(()=>cacheClevelandArtworkImage(900016,{directory}),/Formato invalido/);
  assert.deepEqual(await fs.readdir(directory).catch(()=>[]),[]);
});

test('Image cache does not accept user-controlled artwork identifiers',async()=>{
  await assert.rejects(()=>cacheClevelandArtworkImage(-1),/inválido/);
  await assert.rejects(()=>cacheClevelandArtworkImage(2_147_483_648),/inválido/);
});
