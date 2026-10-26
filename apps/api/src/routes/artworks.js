import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../lib/auth.js';
import { badRequest, wrap } from '../lib/http.js';
import { searchArtworks, getArtworkPreview } from '../services/artworks.js';

export const artworkRoutes=Router();
// A vitrine e os comprovantes precisam funcionar sem autenticacao.
artworkRoutes.get('/:id/preview',wrap(async(req,res)=>{
  const id=z.coerce.number().int().positive().max(2_000_000_000).parse(req.params.id);
  try {
    const image=await getArtworkPreview(id);
    if(!image)return res.status(404).end();
    res.set('Cache-Control','public, max-age=3600');
    res.type('image/gif').send(image);
  }catch(error){
    console.warn('[Art Institute] Preview unavailable:',error.message);
    res.status(503).end();
  }
}));
artworkRoutes.use(requireAuth,requireRole('AUCTIONEER'));
artworkRoutes.get('/',wrap(async(req,res)=>{
  const {q,source}=z.object({q:z.string().trim().min(2,'Busque com pelo menos dois caracteres.').max(80), source:z.enum(['ART_INSTITUTE','CLEVELAND']).optional().default('CLEVELAND')}).parse(req.query);
  try {
    const artworks=await searchArtworks(q,source);
    return res.json({artworks,source:source==='CLEVELAND'?'Cleveland Museum of Art':'Art Institute of Chicago'});
  } catch(error) {
    console.warn('[Catálogo de obras]',error.message);
    badRequest('ARTWORK_API_UNAVAILABLE','O catálogo externo está indisponível. Seus lotes publicados continuam funcionando.',503);
  }
}));
