import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// O diretorio storage ja e persistente no Compose; nao adicionar uploads ao Git.
export const lotImageDirectory = path.join(fileURLToPath(new URL('../../../../', import.meta.url)), 'storage', 'lot-images');

export function detectImageType(data, contentType) {
  if (!Buffer.isBuffer(data) || data.length < 16 || data.length > MAX_IMAGE_BYTES) {
    throw new Error('Envie uma imagem de ate 4 MB.');
  }
  const declared = String(contentType || '').split(';')[0].trim().toLowerCase();
  const jpg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (declared === 'image/jpeg' && jpg) return 'jpg';
  if (declared === 'image/png' && png) return 'png';
  if (declared === 'image/webp' && webp) return 'webp';
  throw new Error('Formato invalido. Use uma imagem JPEG, PNG ou WebP legitima.');
}

export async function saveLotImage({ auctionId, bytes, contentType, directory = lotImageDirectory }) {
  const extension = detectImageType(bytes, contentType);
  const filename = `${auctionId}-${randomUUID()}.${extension}`;
  await fs.mkdir(directory, { recursive: true });
  const filepath = path.join(directory, filename);
  await fs.writeFile(filepath, bytes, { flag: 'wx', mode: 0o600 });
  return { filepath, url: `/lot-images/${filename}` };
}

export async function discardLotImage(filepath) {
  if (filepath) await fs.unlink(filepath).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
}

/** Somente arquivos originados de uploads do MESMO lote podem ser removidos. */
export async function removePreviousLotImage(url, auctionId, directory = lotImageDirectory) {
  if (typeof url !== 'string') return;
  const prefix = `/lot-images/${auctionId}-`;
  if (!url.startsWith(prefix)) return;
  const filename = url.slice('/lot-images/'.length);
  if (!new RegExp(`^${auctionId}-[0-9a-f-]{36}\\.(jpg|png|webp)$`, 'i').test(filename)) return;
  await discardLotImage(path.join(directory, filename));
}
