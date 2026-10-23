/**
 * Fontes de reprodução para as duas obras públicas usadas na demonstração.
 *
 * Servimos primeiro a miniatura local, se instalada por `npm run images:cache`.
 * Em seguida tentamos a reprodução da Wikimedia Commons e a imagem IIIF
 * oficial. Não reutilizamos uma obra para representar outra.
 *
 * Outras obras usam a URL retornada pela API do museu normalmente.
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

export function getArtworkImageCandidates(src: string, artworkId?: number): string[] {
  const known = artworkId === undefined ? undefined : DEMO_IMAGES[artworkId];
  if (!known) return src?.trim() ? [src] : [];
  // Um registro legado do seed usa por engano a URL da obra 27992 no lote 28560.
  // O vínculo pela artworkId garante que não exibiremos o quadro errado.
  return Array.from(new Set(known));
}
