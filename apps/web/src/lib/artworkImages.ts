/**
 * Fontes reais de imagem: priorizar uploads locais e reproduções autorizadas.
 * Não usar a LQIP (2-5 pixels) do museu como imagem final.
 * Para o IIIF, testar variantes oficiais de 843, 600 e 400 px.
 */
const DEMO_IMAGES: Record<number, string[]> = {
  27992: [
    '/artworks/27992.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg',
    'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg'
  ],
  28560: [
    '/artworks/28560.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Van_Gogh_-_The_Bedroom%2C_1889_Chicago.jpg/960px-Van_Gogh_-_The_Bedroom%2C_1889_Chicago.jpg',
    'https://www.artic.edu/iiif/2/6ad8f7d6-c8a9-5216-2664-09bd5691c6ed/full/843,/0/default.jpg'
  ]
};

export function getArtworkImageCandidates(src: string, artworkId?: number, source: 'ART_INSTITUTE'|'CLEVELAND' = 'ART_INSTITUTE'): string[] {
  const imageUrl = src?.trim() || '';

  // Uploads do próprio lote têm prioridade, INCLUSIVE para os dois IDs de demonstração.
  if (imageUrl.startsWith('/lot-images/')) return [imageUrl];

  if (source === 'CLEVELAND') {
    if (!Number.isSafeInteger(artworkId) || !artworkId || artworkId <= 0) return imageUrl ? [imageUrl] : [];
    // Public-domain CDN first; when unavailable, try the server-side persistent
    // cache, which uses a verified URL tied to this exact Cleveland artwork ID.
    const verifiedCdn = /^https:\/\/openaccess-cdn\.clevelandart\.org\//i.test(imageUrl);
    const local = `/catalog-images/cma/${artworkId}`;
    return verifiedCdn ? [imageUrl, local] : [local];
  }

  const known = artworkId === undefined ? undefined : DEMO_IMAGES[artworkId];
  if (known) return [...new Set(known)];
  if (!imageUrl) return [];

  // Variantes de tamanho documentadas pelo Art Institute. Cloudflare ainda pode
  // bloquear todas: nesse caso, mostraremos estado indisponível em vez da LQIP.
  const match = /^https:\/\/www\.artic\.edu\/iiif\/2\/[a-z0-9-]{10,60}\/full\/843,\/0\/default\.jpg$/i.exec(imageUrl);
  if (match) return [
    imageUrl,
    imageUrl.replace('/full/843,/', '/full/600,/'),
    imageUrl.replace('/full/843,/', '/full/400,/')
  ];
  return [imageUrl];
}
