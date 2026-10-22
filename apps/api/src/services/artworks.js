/** Integração de leitura da API pública do Art Institute of Chicago. */
const BASE = 'https://api.artic.edu/api/v1/artworks';
const FIELDS = 'id,title,artist_display,image_id,date_display,is_public_domain';
const cache = new Map();
const MAX_CACHE = 250;

function cached(key) {
  const found = cache.get(key);
  return found && found.expires > Date.now() ? found.value : null;
}
function store(key, value, ttl = 5 * 60_000) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}
function normalize(raw, iiifUrl) {
  if (!Number.isSafeInteger(raw.id) || !raw.title || !raw.image_id || raw.is_public_domain !== true) return null;
  const base = typeof iiifUrl === 'string' && iiifUrl.startsWith('https://www.artic.edu/iiif/2')
    ? iiifUrl.replace(/\/$/, '') : 'https://www.artic.edu/iiif/2';
  const imageId=String(raw.image_id);
  if (!/^[a-zA-Z0-9-]{10,60}$/.test(imageId)) return null;
  return {
    artworkId: raw.id,
    title: String(raw.title).slice(0,280),
    artist: String(raw.artist_display || 'Artista não identificado').slice(0,280),
    imageUrl: `${base}/${imageId}/full/843,/0/default.jpg`,
    artworkDate: String(raw.date_display || 'Data não informada').slice(0,100)
  };
}
async function remote(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept:'application/json', 'User-Agent':'AtelierLeiloes/1.0 (educational project)' } });
  if (!response.ok) throw new Error(`Arte API HTTP ${response.status}`);
  return response.json();
}

export async function searchArtworks(query) {
  const q = query.trim().slice(0,80);
  const key = `search:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;
  const url = new URL(`${BASE}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit','24');
  url.searchParams.set('fields',FIELDS);
  const json = await remote(url);
  const items = (Array.isArray(json.data) ? json.data : [])
    .map(raw=>normalize(raw,json.config?.iiif_url))
    .filter(Boolean).slice(0,12);
  for (const item of items) store(`item:${item.artworkId}`,item,60*60_000);
  return store(key, items);
}

export async function getArtwork(id) {
  const hit=cached(`item:${id}`);
  if(hit) return hit;
  const url=new URL(`${BASE}/${id}`);
  url.searchParams.set('fields',FIELDS);
  const json=await remote(url);
  const item=normalize(json.data || {},json.config?.iiif_url);
  if(!item) return null;
  return store(`item:${item.artworkId}`,item,60*60_000);
}
