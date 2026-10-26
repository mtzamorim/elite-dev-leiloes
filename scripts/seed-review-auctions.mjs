#!/usr/bin/env node
/**
 * Massa demonstrativa de lotes reais (CC0) para avaliação do Ateliê.
 *
 * - Não apaga, reescreve ou cancela lotes existentes.
 * - Seleciona pinturas reais, com imagem web validada e copiada para storage.
 * - Cria lotes ao vivo, agendados e encerrados (com comprovantes genuínos).
 * - Opcionalmente registra lances pelas regras oficiais e pela auditoria.
 * - É idempotente: identifica seus lotes pelo marcador em description.
 *
 * Uso: node scripts/seed-review-auctions.mjs --count=24 --confirm-demo
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const CMA_API = 'https://openaccess-api.clevelandart.org/api/artworks';
export const SEED_MARKER = '[ATELIE_REVIEW_SEED_V1]';
const MAX_COUNT = 60;
const CANDIDATES_PER_PAGE = 100;
const MAX_PAGES = 12;
const THREE_DAYS = 72 * 60 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;
const ONE_HOUR = 60 * 60_000;

export function parseArgs(argv) {
  const opts = { count: 24, dryRun: false, confirmDemo: false, withBids: true };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--dry-run') { opts.dryRun = true; continue; }
    if (arg === '--confirm-demo') { opts.confirmDemo = true; continue; }
    if (arg === '--no-bids') { opts.withBids = false; continue; }
    if (arg.startsWith('--count=')) { opts.count = Number(arg.slice(8)); continue; }
    if (arg === '--count') { opts.count = Number(argv[++index]); continue; }
    throw new Error(`Parâmetro desconhecido: ${arg}`);
  }
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > MAX_COUNT) {
    throw new Error(`--count deve ser um inteiro entre 1 e ${MAX_COUNT}.`);
  }
  return opts;
}

export function statusForIndex(index, total) {
  if (!Number.isInteger(index) || index < 0 || index >= total || !Number.isInteger(total) || total < 1) {
    throw new Error('Índice de lote inválido.');
  }
  const ended = Math.floor(total / 6);
  const scheduled = Math.floor(total / 4);
  if (index < ended) return 'ENDED';
  if (index < ended + scheduled) return 'SCHEDULED';
  return 'LIVE';
}

export function auctionDates(status, index, reference = new Date()) {
  const base = reference.getTime();
  if (status === 'LIVE') return {
    startsAt: new Date(base - (45 + index) * 60_000),
    endsAt: new Date(base + (12 + index % 9) * ONE_DAY)
  };
  if (status === 'SCHEDULED') {
    const start = base + (3 + index % 10) * ONE_HOUR;
    return { startsAt: new Date(start), endsAt: new Date(start + (2 + index % 4) * ONE_DAY) };
  }
  if (status === 'ENDED') return {
    startsAt: new Date(base - THREE_DAYS),
    endsAt: new Date(base - (1 + index % 2) * ONE_DAY)
  };
  throw new Error(`Status não suportado: ${status}`);
}

export function bidPrices(index) {
  const initialCents = 100_000 + (index % 16) * 24_000; // R$ 1.000 a R$ 4.600
  const incrementCents = 10_000 + (index % 4) * 5_000; // R$ 100 a R$ 250
  return { initialCents, incrementCents };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'application/json' }
      });
      if (response.ok) return await response.json();
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
        throw new Error(`HTTP ${response.status} ao consultar ${new URL(url).host}`);
      }
    } catch (error) {
      if (attempt === 3 || (error?.message?.startsWith('HTTP ') && !error.message.includes(' 429') && !/ 50[0234]/.test(error.message))) {
        throw error;
      }
    }
    await sleep(attempt * 750);
  }
  throw new Error('Não foi possível consultar o catálogo público.');
}

async function listPaintingCandidates(normalize, usedIds, needed) {
  const raw = [];
  const seen = new Set(usedIds);
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(CMA_API);
    url.searchParams.set('type', 'Painting');
    url.searchParams.set('cc0', '1');
    url.searchParams.set('has_image', '1');
    url.searchParams.set('limit', String(CANDIDATES_PER_PAGE));
    url.searchParams.set('skip', String(page * CANDIDATES_PER_PAGE));
    const result = await fetchJson(url);
    if (!Array.isArray(result?.data)) throw new Error('Resposta inválida do catálogo Cleveland.');
    for (const record of result.data) {
      const item = normalize(record);
      if (!item || item.artworkSource !== 'CLEVELAND' || seen.has(item.artworkId)) continue;
      seen.add(item.artworkId);
      raw.push(item);
    }
    // Keep a generous pool: CDN availability is checked separately.
    if (raw.length >= Math.max(80, needed * 5)) break;
    if (result.data.length < CANDIDATES_PER_PAGE) break;
  }
  // Rotate in a broad range of artists before taking additional works by the
  // same artist. All metadata is sourced from the museum; none is invented.
  const firstByArtist = [];
  const remainder = [];
  const artists = new Set();
  for (const item of raw) {
    const artist = item.artist.toLocaleLowerCase('pt-BR');
    if (!artists.has(artist)) { artists.add(artist); firstByArtist.push(item); }
    else remainder.push(item);
  }
  return [...firstByArtist, ...remainder];
}

async function chooseVerifiedArtworks(candidates, needed, verifyAndCache) {
  const selected = [];
  let nextIndex = 0;
  let failures = 0;
  const worker = async () => {
    while (nextIndex < candidates.length && selected.length < needed) {
      const item = candidates[nextIndex++];
      try {
        // This checks the image response and saves it to persistent storage.
        // A failed/oversized/invalid image is NOT used to create a lot.
        await verifyAndCache(item.artworkId);
        selected.push(item);
        console.log(`  [imagem OK] #${item.artworkId}: ${item.title}`);
      } catch (error) {
        failures++;
        if (failures <= 12) console.warn(`  [ignorada] #${item.artworkId}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, worker));
  return { selected: selected.slice(0, needed), failures };
}

async function ensureFunds(prisma, userId, minimumAvailable) {
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const missing = minimumAvailable - (user.balanceCents - user.lockedCents);
    if (missing <= 0n) return;
    await tx.user.update({ where: { id: userId }, data: { balanceCents: { increment: missing } } });
    await tx.walletEntry.create({ data: { userId, kind: 'DEPOSIT', amountCents: missing } });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Massa demonstrativa de pinturas - Ateliê\n\nUso:\n  node scripts/seed-review-auctions.mjs --count=24 --confirm-demo\n\nOpções:\n  --count=N       Número total de lotes desta massa (1 a ${MAX_COUNT}; padrão 24)\n  --dry-run       Prévia de distribuição sem gravar no banco ou baixar imagens\n  --no-bids       Não gerar lances; lotes encerrados ficam sem vencedor\n  --confirm-demo  Confirma que o banco é demonstrativo (exigido para gravar)\n  --help          Exibir esta ajuda\n\nAntes: npm run db:migrate && npm run db:seed\nRequer a migração ArtworkSource/CLEVELAND e DEMO_SEED=true no .env.`);
    return;
  }
  // The app loader finds .env at the repository root on Windows and Linux.
  const { env, assertConfiguration, projectRoot } = await import('../apps/api/src/lib/env.js');
  assertConfiguration();
  if (process.env.DEMO_SEED !== 'true') {
    throw new Error('Execução bloqueada: configure DEMO_SEED=true no .env para preparar massa fictícia.');
  }
  if (!opts.dryRun && !opts.confirmDemo) {
    throw new Error('A operação grava dados. Execute novamente com --confirm-demo.');
  }
  const { normalizeClevelandArtwork } = await import('../apps/api/src/services/artworks.js');
  if (typeof normalizeClevelandArtwork !== 'function') {
    throw new Error('Integração Cleveland ausente. Aplique a correção do catálogo CC0 antes deste seed.');
  }

  const { prisma } = await import('../apps/api/src/lib/db.js');
  try {
    // Fails early on older schema/Prisma Client versions: no partial inserts.
    await prisma.auction.findFirst({ select: { id: true, artworkSource: true } });
    const seller = await prisma.user.findUnique({ where: { email: 'leiloeiro@demo.com' } });
    const ana = await prisma.user.findUnique({ where: { email: 'ana@demo.com' } });
    const bruno = await prisma.user.findUnique({ where: { email: 'bruno@demo.com' } });
    if (!seller || seller.role !== 'AUCTIONEER' || (opts.withBids && (!ana || !bruno || ana.role !== 'BIDDER' || bruno.role !== 'BIDDER'))) {
      throw new Error('Contas demo ausentes. Execute npm run db:seed antes deste script.');
    }
    const existingLots = await prisma.auction.findMany({
      where: { ownerId: seller.id, artworkSource: 'CLEVELAND' },
      select: { id: true, artworkId: true, status: true, description: true }
    });
    const seeded = existingLots.filter(lot => lot.description.includes(SEED_MARKER));
    const remaining = Math.max(0, opts.count - seeded.length);
    console.log(`\nAteliê - massa de avaliação CC0 | Alvo: ${opts.count} lotes | Já presentes: ${seeded.length} | A criar: ${remaining}`);
    if (!remaining) {
      console.log('Massa já preparada. Não alterei lotes, lances ou comprovantes.');
      return;
    }

    console.log('Buscando pinturas CC0 com imagem no Cleveland Museum of Art...');
    const usedIds = new Set(existingLots.map(lot => lot.artworkId));
    const candidates = await listPaintingCandidates(normalizeClevelandArtwork, usedIds, remaining);
    if (candidates.length < remaining) throw new Error(`Catálogo retornou somente ${candidates.length} pinturas candidatas para ${remaining} lotes.`);
    if (opts.dryRun) {
      console.log(`Prévia: ${candidates.length} candidatas (imagens ainda não verificadas).`);
      for (let i = seeded.length; i < opts.count; i++) {
        const item = candidates[i - seeded.length];
        console.log(`  [${statusForIndex(i,opts.count)}] ${item?.title || '(sem obra)'} - ${item?.artist || ''}`);
      }
      console.log('Nenhum dado ou imagem foi gravado.');
      return;
    }

    const { cacheClevelandArtworkImage } = await import('../apps/api/src/services/catalogImages.js');
    const { placeBid, settleAuction } = await import('../apps/api/src/services/auctions.js');
    console.log('Validando e salvando imagens no cache persistente...');
    const { selected, failures } = await chooseVerifiedArtworks(candidates, remaining, cacheClevelandArtworkImage);
    if (selected.length !== remaining) {
      throw new Error(`Somente ${selected.length}/${remaining} imagens foram recuperadas; ${failures} falharam. Nenhum lote novo foi criado. Verifique o acesso ao CDN do museu e execute novamente.`);
    }

    if (opts.withBids) {
      // Controlled fictional deposit with a ledger entry; never overwrite money
      // or reservations that already exist. No real payment is processed.
      const minimum = BigInt(Math.max(12_000_000, opts.count * 500_000));
      await ensureFunds(prisma, ana.id, minimum);
      await ensureFunds(prisma, bruno.id, minimum);
    }

    const report = [];
    const batchNow = new Date();
    for (let offset = 0; offset < remaining; offset++) {
      const index = seeded.length + offset;
      const item = selected[offset];
      const finalStatus = statusForIndex(index, opts.count);
      const finalDates = auctionDates(finalStatus, index, batchNow);
      const { initialCents, incrementCents } = bidPrices(index);
      const hasBids = opts.withBids && (finalStatus === 'ENDED' ? index % 4 !== 3 : finalStatus === 'LIVE' && index % 3 === 0);
      const isEnded = finalStatus === 'ENDED';
      const tempEnd = new Date(batchNow.getTime() + 6 * ONE_HOUR);
      const auction = await prisma.auction.create({ data: {
        ownerId: seller.id,
        artworkSource: 'CLEVELAND', artworkId: item.artworkId,
        artworkUrl: item.artworkUrl, title: item.title,
        artist: item.artist, artworkDate: item.artworkDate,
        imageUrl: `/catalog-images/cma/${item.artworkId}`,
        description: `Obra de acervo público com reprodução CC0 do Cleveland Museum of Art. Leilão fictício destinado à avaliação das funcionalidades do Ateliê. ${SEED_MARKER}`,
        initialBidCents: BigInt(initialCents), incrementCents: BigInt(incrementCents),
        startsAt: finalDates.startsAt,
        endsAt: isEnded ? tempEnd : finalDates.endsAt,
        status: isEnded ? 'LIVE' : finalStatus
      } });
      let receiptId = null;
      try {
        if (hasBids) {
          const firstBid = await placeBid({
            auctionId: auction.id, userId: ana.id, amountCents: initialCents,
            secret: env.auditSecret, anchorFile: env.anchorFile
          });
          const secondBid = await placeBid({
            auctionId: auction.id, userId: bruno.id,
            amountCents: initialCents + incrementCents,
            secret: env.auditSecret, anchorFile: env.anchorFile
          });
          if (!firstBid.auditAnchored || !secondBid.auditAnchored) {
            throw new Error('Âncora de auditoria pendente: não conclua a massa até recuperar o arquivo.');
          }
        }
        if (isEnded) {
          await prisma.auction.update({where:{id:auction.id},data:{endsAt:finalDates.endsAt}});
          const result = await settleAuction({auctionId:auction.id,secret:env.auditSecret,anchorFile:env.anchorFile});
          if (!result) throw new Error(`Falha na liquidação do lote ${auction.id}.`);
          receiptId = result.receiptId;
        }
      } catch (error) {
        console.error(`Falha ao preparar o lote ${auction.id}; o registro foi mantido para investigação.`,error);
        throw error;
      }
      report.push({id:auction.id,artworkId:item.artworkId,title:item.title,artist:item.artist,status:finalStatus,hasBids,receiptId,imageUrl:`/catalog-images/cma/${item.artworkId}`});
      console.log(`  [${String(index + 1).padStart(2,'0')}/${opts.count}] ${finalStatus.padEnd(9)} ${item.title}${receiptId ? ' - comprovante gerado' : ''}`);
    }
    const summary = report.reduce((acc, lot) => ({...acc,[lot.status]:(acc[lot.status]||0)+1}), {});
    const folder = path.join(projectRoot,'storage');
    await mkdir(folder,{recursive:true});
    const reportFile = path.join(folder,'seed-review-report.json');
    await writeFile(reportFile,JSON.stringify({generatedAt:new Date().toISOString(),countRequested:opts.count,existing:seeded.length,created:report.length,statuses:summary,items:report},null,2),'utf8');
    console.log('\nMassa de avaliação pronta.');
    console.log(`  Novos lotes: ${report.length} | Ao vivo: ${summary.LIVE||0} | Agendados: ${summary.SCHEDULED||0} | Encerrados: ${summary.ENDED||0}`);
    console.log(`  Imagens locais: storage/catalog-images | Relatório: ${reportFile}`);
    console.log('  Acesse a vitrine e confira as abas Ao vivo, Em breve e Encerrados.');
    console.log('  Mantenha o arquivo de âncoras e AUDIT_SECRET para preservar a auditoria.');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error('\n[SEED DE AVALIAÇÃO] Falha:',error.message);
    process.exitCode = 1;
  });
}
