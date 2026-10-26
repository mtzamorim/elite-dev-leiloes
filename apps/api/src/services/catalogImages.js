import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getClevelandArtwork } from './artworks.js';
import { MAX_IMAGE_BYTES, detectImageType } from './lotImages.js';

// The catalog cache is on the same persistent storage mount as lot uploads.
// No image data is written to the repository or to PostgreSQL.
export const catalogImageDirectory = path.join(
  fileURLToPath(new URL('../../../../', import.meta.url)), 'storage', 'catalog-images'
);

const mime = { jpg:'image/jpeg', png:'image/png', webp:'image/webp' };
const inflight = new Map();

async function fromDisk(id, directory) {
  for (const extension of Object.keys(mime)) {
    try {
      const bytes = await fs.readFile(path.join(directory, `${id}.${extension}`));
      return { bytes, contentType:mime[extension] };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

function validatedCdnUrl(imageUrl) {
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'openaccess-cdn.clevelandart.org' || url.username || url.password) {
    throw new Error('Imagem fora do CDN público autorizado.');
  }
  return url;
}

async function download(id, directory) {
  const onDisk = await fromDisk(id, directory);
  if (onDisk) return onDisk;
  const artwork = await getClevelandArtwork(id);
  if (!artwork) throw new Error('Obra CC0 não encontrada no catálogo público.');
  const url = validatedCdnUrl(artwork.imageUrl);
  const response = await fetch(url, {
    signal:AbortSignal.timeout(9000), redirect:'error',
    headers:{Accept:'image/jpeg,image/png,image/webp'}
  });
  if (!response.ok) throw new Error(`Imagem do catálogo HTTP ${response.status}`);
  const declared = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const reportedSize = Number(response.headers.get('content-length') || 0);
  if (reportedSize > MAX_IMAGE_BYTES) throw new Error('Imagem externa acima do limite de 4 MB.');
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = detectImageType(bytes, declared);

  await fs.mkdir(directory, {recursive:true});
  const temporary = path.join(directory, `${id}-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});
    await fs.rename(temporary,path.join(directory,`${id}.${extension}`));
  } finally {
    await fs.rm(temporary,{force:true}).catch(()=>{});
  }
  return {bytes,contentType:mime[extension]};
}

export async function cacheClevelandArtworkImage(id,{directory=catalogImageDirectory}={}) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new Error('Identificador de obra inválido.');
  const key = `${directory}:${id}`;
  if (inflight.has(key)) return inflight.get(key);
  const job = download(id,directory);
  inflight.set(key,job);
  try { return await job; }
  finally { inflight.delete(key); }
}
