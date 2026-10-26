import test from 'node:test';
import assert from 'node:assert/strict';
import { getArtwork, searchArtworks, normalizeClevelandArtwork } from '../src/services/artworks.js';

const cdn = (id) => `https://openaccess-cdn.clevelandart.org/cc0/${id}.jpg`;
function record(id, overrides={}) {
  return {id, title:'Water Lilies', share_license_status:'CC0', creation_date:'1900',
    accession_number:'1958.31', creators:[{description:'Claude Monet (French, 1840-1926)'}],
    images:{web:{url:cdn(id)}},...overrides};
}
const okJson = (value) => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('Cleveland search returns real CC0 images, source and exact museum attribution',async t=>{
  const inputs=[];
  t.mock.method(globalThis,'fetch', async input=>{
    const url=new URL(input); inputs.push(url);
    assert.equal(url.hostname,'openaccess-api.clevelandart.org');
    assert.equal(url.searchParams.get('q'),'Monet production catalog example');
    assert.equal(url.searchParams.has('cc0'),true);
    assert.equal(url.searchParams.get('has_image'),'1');
    return okJson({data:[
      record(890001), record(890002,{share_license_status:'Copyrighted'}),
      record(890003,{images:{web:null}}), record(890004,{images:{web:{url:'http://example.com/not-image'}}})
    ]});
  });
  const results=await searchArtworks('Monet production catalog example','CLEVELAND');
  assert.equal(inputs.length,1);
  assert.equal(results.length,1);
  assert.deepEqual(results[0],{
    artworkSource:'CLEVELAND', artworkId:890001,title:'Water Lilies',
    artist:'Claude Monet (French, 1840-1926)',imageUrl:cdn(890001),artworkDate:'1900',
    artworkUrl:'https://www.clevelandart.org/art/1958.31'
  });
  assert.equal((await getArtwork(890001,'CLEVELAND')).imageUrl,cdn(890001));
  assert.equal(inputs.length,1,'selected artwork cached without a second API call');
});

test('Cleveland direct lookup uses its own namespaced cache, not AIC IDs',async t=>{
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    assert.equal(url.pathname,'/api/artworks/890011');
    return okJson({data:record(890011,{title:'Real source isolated'})});
  });
  const item=await getArtwork(890011,'CLEVELAND');
  assert.equal(item.artworkSource,'CLEVELAND');
  assert.equal(item.artworkId,890011);
  assert.equal(item.title,'Real source isolated');
});

test('Cleveland excludes records with copyrighted or untrusted image origins',()=>{
  assert.equal(normalizeClevelandArtwork(record(90001,{share_license_status:'Other'})),null);
  assert.equal(normalizeClevelandArtwork(record(90002,{images:{web:{url:'https://example.com/xx.jpg'}}})),null);
  assert.equal(normalizeClevelandArtwork(record(90003,{images:{web:{url:'http://openaccess-cdn.clevelandart.org/xx.jpg'}}})),null);
  assert.equal(normalizeClevelandArtwork(record(90004,{id:-1})),null);
});

test('Cleveland responds with empty list when no matching CC0 works exist',async t=>{
  t.mock.method(globalThis,'fetch',async()=>okJson({data:[]}));
  const list=await searchArtworks('No works in this 2026 example query','CLEVELAND');
  assert.deepEqual(list,[]);
});

test('Cleveland provider errors are not silently replaced with incorrect paintings',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('error',{status:503}));
  await assert.rejects(()=>searchArtworks('Unavailable specific 2026 search','CLEVELAND'),/HTTP 503/);
});
