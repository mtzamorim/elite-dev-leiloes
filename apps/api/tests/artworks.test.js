import test from 'node:test';
import assert from 'node:assert/strict';
import { searchArtworks, getArtwork } from '../src/services/artworks.js';

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
function artwork(id, title, artist, overrides = {}) {
  return {
    id, title, artist_display: artist,
    image_id: 'f1234567-1234-1234-1234-123456789abc',
    is_public_domain: true,
    date_display: '1900',
    ...overrides
  };
}

// The AIC search index can provide only id/title/thumbnail. The application
// must obtain complete public-domain metadata from /artworks?ids=... .
test('artist search hydrates summary hits, preserves rank and caches details', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith('/search')) {
      assert.equal(url.searchParams.get('q'), 'Mock artist full catalog');
      assert.equal(url.searchParams.get('query[term][is_public_domain]'), 'true');
      return response({ data: [
        { id: 61002, title: 'Second', thumbnail: {} },
        { id: 61001, title: 'First', thumbnail: {} },
        { id: 61003, title: 'Copyrighted', thumbnail: {} },
        { id: 61002, title: 'Duplicate' }
      ] });
    }
    assert.equal(url.pathname, '/api/v1/artworks');
    assert.equal(url.searchParams.get('ids'), '61002,61001,61003');
    assert.equal(url.searchParams.get('limit'), '3');
    assert.ok(url.searchParams.get('fields').includes('is_public_domain'));
    return response({ data: [
      artwork(61001, 'First', 'Mock Artist'),
      artwork(61003, 'Copyrighted', 'Mock Artist', { is_public_domain: false }),
      artwork(61002, 'Second', 'Mock Artist')
    ], config: { iiif_url: 'https://www.artic.edu/iiif/2' } });
  });
  const found = await searchArtworks('Mock artist full catalog');
  assert.deepEqual(found.map(item => item.artworkId), [61002, 61001]);
  assert.equal(found[0].artist, 'Mock Artist');
  assert.match(found[0].imageUrl, /\/full\/843,\/0\/default\.jpg$/);
  assert.equal((await getArtwork(61002)).title, 'Second');
  assert.equal(calls.length, 2, 'the selected artwork is served from cache');
});

test('search without matches never requests an empty details batch', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return response({ data: [] });
  });
  assert.deepEqual(await searchArtworks('Empty catalog unique query'), []);
  assert.equal(calls, 1);
});

test('items without image or without public-domain rights are excluded', async t => {
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/search')) return response({ data: [{ id: 62001 }, { id: 62002 }] });
    return response({ data: [
      artwork(62001, 'Without image', 'Someone', { image_id: null }),
      artwork(62002, 'Protected', 'Someone', { is_public_domain: false })
    ] });
  });
  assert.deepEqual(await searchArtworks('Non public domain unique query'), []);
});

test('transient provider errors are retried once before hydrating artwork', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    calls++;
    const url = new URL(input);
    if (calls === 1) return response({ message: 'rate limited' }, 429);
    if (url.pathname.endsWith('/search')) return response({ data: [{ id: 63001, title: 'Example' }] });
    return response({ data: [artwork(63001, 'Example', 'Retry artist')] });
  });
  assert.equal((await searchArtworks('Transient retry unique query'))[0].artist, 'Retry artist');
  assert.equal(calls, 3);
});

test('demo works can still be selected and used when AIC is offline', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network offline'); });
  t.mock.method(console, 'warn', () => {});
  const works = await searchArtworks('Seurat');
  assert.equal(works.length, 1);
  assert.equal(works[0].artworkId, 27992);
  assert.equal(works[0].imageUrl, '/artworks/27992.jpg');
  assert.equal((await getArtwork(27992)).artworkId, 27992);
});

test('unsupported offline searches return an error rather than inventing works', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ message: 'forbidden' }, 403));
  await assert.rejects(() => searchArtworks('Unlisted artist no demo entry'), /HTTP 403/);
});

test('direct artwork lookup uses the official detail endpoint', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    calls++;
    assert.equal(url.pathname, '/api/v1/artworks/64001');
    assert.ok(url.searchParams.get('fields').includes('image_id'));
    return response({ data: artwork(64001, 'Single artwork', 'Some artist') });
  });
  assert.equal((await getArtwork(64001)).title, 'Single artwork');
  assert.equal(calls, 1);
});

test('direct demo artwork lookup survives an unavailable upstream', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ message: 'offline' }, 403));
  t.mock.method(console, 'warn', () => {});
  const item = await getArtwork(28560);
  assert.equal(item?.artist, 'Vincent van Gogh');
  assert.equal(item?.imageUrl, '/artworks/28560.jpg');
});
