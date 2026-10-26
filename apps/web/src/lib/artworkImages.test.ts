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

  it('prioriza uploads reais, mesmo nas obras do seed', () => {
    const local = '/lot-images/12345678-abcd-1234-abcd-123456789012-real.jpg';
    expect(getArtworkImageCandidates(local, 27992)).toEqual([local]);
    expect(getArtworkImageCandidates(local, 28560)).toEqual([local]);
    expect(getArtworkImageCandidates(local, 999999)).toEqual([local]);
  });

  it('tenta tamanhos oficiais para as obras novas sem ampliar miniaturas LQIP', () => {
    const url = 'https://www.artic.edu/iiif/2/11111111-2222-3333-4444-555555555555/full/843,/0/default.jpg';
    expect(getArtworkImageCandidates(url, 999999)).toEqual([
      url,
      url.replace('/full/843,/', '/full/600,/'),
      url.replace('/full/843,/', '/full/400,/')
    ]);
    expect(getArtworkImageCandidates('', 999999)).toEqual([]);
  });

  it('preserva as URLs não IIIF sem inventar imagens para outra obra', () => {
    expect(getArtworkImageCandidates('https://example.org/licensed.jpg', 999999))
      .toEqual(['https://example.org/licensed.jpg']);
  });
});

describe('novo catalogo com imagens CC0', () => {
  it('prioriza CDN verificavel e usa cache no proprio servidor quando falhar', () => {
    const url = 'https://openaccess-cdn.clevelandart.org/cc0/27992.jpg';
    expect(getArtworkImageCandidates(url, 27992, 'CLEVELAND'))
      .toEqual([url, '/catalog-images/cma/27992']);
  });
  it('nao confunde o mesmo ID de dois museus e sempre respeita upload local', () => {
    const uploaded = '/lot-images/00000000-0000-0000-0000-000000000000-example.jpg';
    expect(getArtworkImageCandidates(uploaded, 27992, 'CLEVELAND')).toEqual([uploaded]);
    expect(getArtworkImageCandidates('https://wrong.example.com/a.jpg', 27992, 'CLEVELAND'))
      .toEqual(['/catalog-images/cma/27992']);
  });
});
