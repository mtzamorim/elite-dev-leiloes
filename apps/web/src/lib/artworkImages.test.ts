import { describe, expect, it } from 'vitest';
import { getArtworkImageCandidates } from './artworkImages';

describe('fontes de imagem de obras', () => {
  it('usa a miniatura local e alternativas públicas para Seurat', () => {
    const candidates = getArtworkImageCandidates('https://www.artic.edu/iiif/2/exemplo.jpg', 27992);
    expect(candidates[0]).toBe('/artworks/27992.jpg');
    expect(candidates).toHaveLength(3);
    expect(candidates[1]).toContain('A_Sunday_on_La_Grande_Jatte');
  });

  it('nunca mostra Seurat no lote de Van Gogh quando o seed antigo contém URL errada', () => {
    const seurat = 'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg';
    const candidates = getArtworkImageCandidates(seurat, 28560);
    expect(candidates[0]).toBe('/artworks/28560.jpg');
    expect(candidates.some(url => url.includes('2d484387'))).toBe(false);
    expect(candidates.some(url => url.includes('Van_Gogh'))).toBe(true);
  });

  it('preserva a URL de obras selecionadas dinamicamente na API', () => {
    expect(getArtworkImageCandidates('https://www.artic.edu/iiif/2/outra-obra.jpg', 999999))
      .toEqual(['https://www.artic.edu/iiif/2/outra-obra.jpg']);
    expect(getArtworkImageCandidates('', 999999)).toEqual([]);
  });
});
