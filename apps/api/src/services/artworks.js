/** Art Institute of Chicago: search returns IDs; details supply licensing and images. */
const CLEVELAND_BASE = 'https://openaccess-api.clevelandart.org/api/artworks';
const BASE = 'https://api.artic.edu/api/v1/artworks';
const FIELDS = 'id,title,artist_display,image_id,date_display,is_public_domain';
const cache = new Map();
const MAX_CACHE = 250;
const MAX_RESULTS = 12;
const SEARCH_CANDIDATES = 40;

// Known public-domain works already shipped with the demonstration assets.
// These are used only when the remote catalog cannot be reached.
const DEMO_ARTWORKS = [
  { artworkSource: 'ART_INSTITUTE', artworkUrl:'https://www.artic.edu/artworks/27992', artworkId: 27992, title: 'A Sunday on La Grande Jatte - 1884', artist: 'Georges Seurat', artworkDate: '1884-1886', imageUrl: '/artworks/27992.jpg' },
  { artworkSource: 'ART_INSTITUTE', artworkUrl:'https://www.artic.edu/artworks/28560', artworkId: 28560, title: 'The Bedroom', artist: 'Vincent van Gogh', artworkDate: '1889', imageUrl: '/artworks/28560.jpg' }
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
    artworkSource: 'ART_INSTITUTE',
    artworkUrl: `https://www.artic.edu/artworks/${raw.id}`,
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

export async function searchArtworks(query, source = 'ART_INSTITUTE') {
  if (source === 'CLEVELAND') return searchClevelandArtworks(query);
  if (source !== 'ART_INSTITUTE') throw new Error('Unknown artwork catalog.');
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

export async function getArtwork(id, source = 'ART_INSTITUTE') {
  if (source === 'CLEVELAND') return getClevelandArtwork(id);
  if (source !== 'ART_INSTITUTE') throw new Error('Unknown artwork catalog.');
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

/**
 * Previa publica de 2-5 pixels fornecida na API de metadados do museu.
 * Usada APENAS quando o IIIF de alta resolucao nao carrega (ex.: Cloudflare 403).
 * Nao substitui uma reproducao autentica de boa qualidade.
 */
export async function getArtworkPreview(artworkId) {
  const key = `preview:${artworkId}`;
  const hit = cached(key);
  if (hit) return hit;
  const url = new URL(`${BASE}/${artworkId}`);
  url.searchParams.set('fields', 'id,is_public_domain,thumbnail');
  const json = await remote(url);
  if (json?.data?.id !== artworkId || json.data.is_public_domain !== true) return null;
  const lqip = json.data.thumbnail?.lqip;
  if (typeof lqip !== 'string' || lqip.length > 16_000) return null;
  const match = /^data:image\/gif;base64,([a-zA-Z0-9+/]+={0,2})$/.exec(lqip);
  if (!match) return null;
  const data = Buffer.from(match[1], 'base64');
  if (data.length < 15 || data.length > 12_000 || !['GIF87a','GIF89a'].includes(data.toString('ascii',0,6))) return null;
  return store(key, data, 60 * 60_000);
}

/**
 * Cleveland Museum of Art Open Access API: returns web-ready image URLs
 * alongside metadata. Only works with CC0 imagery are presented as new lots.
 * This catalog is intentionally independent of the Art Institute IIIF host,
 * whose image delivery may return Cloudflare challenges.
 */
function validClevelandImage(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'openaccess-cdn.clevelandart.org'
      ? parsed.toString() : null;
  } catch { return null; }
}

export function normalizeClevelandArtwork(raw) {
  if (!Number.isSafeInteger(raw?.id) || raw.id <= 0 || raw.id > 2147483647 ||
      typeof raw.title !== 'string' || !raw.title.trim() ||
      String(raw.share_license_status).toUpperCase() !== 'CC0') return null;
  const imageUrl = validClevelandImage(raw.images?.web?.url);
  if (!imageUrl) return null;
  const artists = Array.isArray(raw.creators) ? raw.creators
    .map(creator => String(creator?.description || creator?.name || '').trim())
    .filter(Boolean).slice(0, 2).join(' / ') : '';
  const accession = typeof raw.accession_number === 'string' ? raw.accession_number.trim() : '';
  return {
    artworkSource: 'CLEVELAND',
    artworkId: raw.id,
    title: raw.title.trim().slice(0, 280),
    artist: (artists || 'Artista não identificado').slice(0, 280),
    imageUrl,
    artworkDate: String(raw.creation_date || raw.date_text || 'Data não informada').slice(0, 100),
    artworkUrl: accession
      ? `https://www.clevelandart.org/art/${encodeURIComponent(accession)}`
      : 'https://www.clevelandart.org/art'
  };
}

async function clevelandRemote(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Cleveland Museum API HTTP ${response.status}`);
  return response.json();
}

export async function searchClevelandArtworks(query) {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const key = `cma:search:${q.toLocaleLowerCase('pt-BR')}`;
  const hit = cached(key);
  if (hit) return hit;
  try {
    const url = new URL(CLEVELAND_BASE);
    url.searchParams.set('q', q);
    url.searchParams.set('cc0', '');
    url.searchParams.set('has_image', '1');
    url.searchParams.set('limit', '25');
    const json = await clevelandRemote(url);
    if (!Array.isArray(json?.data)) throw new Error('Invalid Cleveland artwork response.');
    const items = json.data.map(normalizeClevelandArtwork).filter(Boolean).slice(0, MAX_RESULTS);
    for (const item of items) store(`cma:item:${item.artworkId}`, item, 60 * 60_000);
    return store(key, items, items.length ? 5 * 60_000 : 60_000);
  } catch (error) {
    // A temporary provider outage should not discard an earlier valid listing.
    const stale = cached(key, true);
    if (stale?.length) return stale;
    throw error;
  }
}

export async function getClevelandArtwork(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const key = `cma:item:${id}`;
  const hit = cached(key);
  if (hit) return hit;
  const json = await clevelandRemote(`${CLEVELAND_BASE}/${id}`);
  const item = normalizeClevelandArtwork(json?.data);
  if (!item || item.artworkId !== id) return null;
  return store(key, item, 60 * 60_000);
}
