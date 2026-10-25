/** Art Institute of Chicago: search returns IDs; details supply licensing and images. */
const BASE = 'https://api.artic.edu/api/v1/artworks';
const FIELDS = 'id,title,artist_display,image_id,date_display,is_public_domain';
const cache = new Map();
const MAX_CACHE = 250;
const MAX_RESULTS = 12;
const SEARCH_CANDIDATES = 40;

// Known public-domain works already shipped with the demonstration assets.
// These are used only when the remote catalog cannot be reached.
const DEMO_ARTWORKS = [
  { artworkId: 27992, title: 'A Sunday on La Grande Jatte - 1884', artist: 'Georges Seurat', artworkDate: '1884-1886', imageUrl: '/artworks/27992.jpg' },
  { artworkId: 28560, title: 'The Bedroom', artist: 'Vincent van Gogh', artworkDate: '1889', imageUrl: '/artworks/28560.jpg' }
];

function cached(key, allowExpired = false) {
  const found = cache.get(key);
  return found && (allowExpired || found.expires > Date.now()) ? found.value : null;
}
function store(key, value, ttl = 5 * 60_000) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}
function normalize(raw, iiifUrl) {
  if (!Number.isSafeInteger(raw?.id) || !raw.title || !raw.image_id || raw.is_public_domain !== true) return null;
  const base = typeof iiifUrl === 'string' && iiifUrl.startsWith('https://www.artic.edu/iiif/2')
    ? iiifUrl.replace(/\/$/, '') : 'https://www.artic.edu/iiif/2';
  const imageId = String(raw.image_id);
  if (!/^[a-zA-Z0-9-]{10,60}$/.test(imageId)) return null;
  return {
    artworkId: raw.id,
    title: String(raw.title).slice(0, 280),
    artist: String(raw.artist_display || 'Artista \u006e\u00e3o identificado').slice(0, 280),
    imageUrl: `${base}/${imageId}/full/843,/0/default.jpg`,
    artworkDate: String(raw.date_display || 'Data \u006e\u00e3o informada').slice(0, 100)
  };
}
function demoMatches(query) {
  const q = query.toLocaleLowerCase('pt-BR');
  return DEMO_ARTWORKS.filter(item =>
    `${item.title} ${item.artist}`.toLocaleLowerCase('pt-BR').includes(q)
  );
}
async function remote(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: 'application/json', 'AIC-User-Agent': 'AtelierLeiloes/1.0' }
      });
      if (response.ok) return response.json();
      const error = new Error(`Art Institute API HTTP ${response.status}`);
      if (attempt === 1 || ![429, 502, 503, 504].includes(response.status)) throw error;
    } catch (error) {
      const networkError = error instanceof TypeError || ['AbortError', 'TimeoutError'].includes(error?.name);
      if (attempt === 1 || !networkError) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

export async function searchArtworks(query) {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const key = `search:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;

  try {
    // Search hits may contain only id/title/thumbnail. Do not filter them by
    // image_id or is_public_domain before retrieving the actual artwork data.
    const searchUrl = new URL(`${BASE}/search`);
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('limit', String(SEARCH_CANDIDATES));
    searchUrl.searchParams.set('query[term][is_public_domain]', 'true');
    const searchJson = await remote(searchUrl);
    if (!Array.isArray(searchJson?.data)) throw new Error('Invalid artwork search response.');

    const ids = Array.from(new Set(searchJson.data
      .map(item => item?.id)
      .filter(id => Number.isSafeInteger(id) && id > 0))).slice(0, SEARCH_CANDIDATES);
    if (!ids.length) return store(key, [], 60_000);

    // The listing endpoint supports bulk detail retrieval, minimizing API calls.
    const detailUrl = new URL(BASE);
    detailUrl.searchParams.set('ids', ids.join(','));
    detailUrl.searchParams.set('fields', FIELDS);
    detailUrl.searchParams.set('limit', String(ids.length));
    const detailJson = await remote(detailUrl);
    if (!Array.isArray(detailJson?.data)) throw new Error('Invalid artwork detail response.');

    const byId = new Map(detailJson.data.map(raw => [raw?.id, normalize(raw, detailJson.config?.iiif_url)]));
    const items = ids.map(id => byId.get(id)).filter(Boolean).slice(0, MAX_RESULTS);
    for (const item of items) store(`item:${item.artworkId}`, item, 60 * 60_000);
    return store(key, items, items.length ? 5 * 60_000 : 60_000);
  } catch (error) {
    // A failure must not invalidate an earlier successful query.
    const stale = cached(key, true);
    if (stale?.length) return stale;
    const demo = demoMatches(q);
    if (demo.length) {
      console.warn('[Art Institute] Remote catalog unavailable; serving the known demo artworks:', error.message);
      for (const item of demo) store(`item:${item.artworkId}`, item, 60 * 60_000);
      return store(key, demo, 30_000);
    }
    throw error;
  }
}

export async function getArtwork(id) {
  const hit = cached(`item:${id}`);
  if (hit) return hit;
  const url = new URL(`${BASE}/${id}`);
  url.searchParams.set('fields', FIELDS);
  try {
    const json = await remote(url);
    const item = normalize(json.data || {}, json.config?.iiif_url);
    if (!item) return null;
    return store(`item:${item.artworkId}`, item, 60 * 60_000);
  } catch (error) {
    const demo = DEMO_ARTWORKS.find(item => item.artworkId === id);
    if (demo) {
      console.warn('[Art Institute] Demo artwork loaded from local snapshot:', error.message);
      return store(`item:${id}`, demo, 60 * 60_000);
    }
    throw error;
  }
}
