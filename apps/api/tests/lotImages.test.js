import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectImageType, saveLotImage, removePreviousLotImage, MAX_IMAGE_BYTES } from '../src/services/lotImages.js';

const jpeg=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(15),Buffer.from([0xff,0xd9])]);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
const webp=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.alloc(20)]);

test('accepts only legitimate JPEG PNG and WebP headers under the size limit',()=>{
  assert.equal(detectImageType(jpeg,'image/jpeg'),'jpg');
  assert.equal(detectImageType(png,'image/png'),'png');
  assert.equal(detectImageType(webp,'image/webp'),'webp');
  assert.throws(()=>detectImageType(Buffer.from('<html>not an image</html>'),'image/jpeg'));
  assert.throws(()=>detectImageType(jpeg,'image/svg+xml'));
  assert.throws(()=>detectImageType(jpeg,'image/png'));
  assert.throws(()=>detectImageType(Buffer.alloc(MAX_IMAGE_BYTES+1),'image/jpeg'));
});

test('images are stored with random names and only a previous image of same lot is removed',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-lotimages-'));
  const auctionId='92b7a85a-e70f-41f8-9ed8-7d306e57f2ab';
  const differentId='69afbeaf-d57c-4fa5-a95c-26e3c9e9e556';
  try {
    const first=await saveLotImage({auctionId,bytes:jpeg,contentType:'image/jpeg',directory});
    const second=await saveLotImage({auctionId:differentId,bytes:jpeg,contentType:'image/jpeg',directory});
    assert.notEqual(first.url,second.url);
    assert.match(first.url,/^\/lot-images\/[a-f0-9-]+\.jpg$/);
    assert.deepEqual(await fs.readFile(first.filepath),jpeg);
    await removePreviousLotImage(first.url,differentId,directory);
    assert.deepEqual(await fs.readFile(first.filepath),jpeg);
    await removePreviousLotImage(first.url,auctionId,directory);
    await assert.rejects(()=>fs.access(first.filepath));
    assert.deepEqual(await fs.readFile(second.filepath),jpeg);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
