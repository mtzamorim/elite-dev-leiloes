import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../lib/auth.js';
import { badRequest, wrap } from '../lib/http.js';
import { searchArtworks } from '../services/artworks.js';

export const artworkRoutes=Router();
artworkRoutes.use(requireAuth,requireRole('AUCTIONEER'));
artworkRoutes.get('/',wrap(async(req,res)=>{
  const {q}=z.object({q:z.string().trim().min(2,'Busque com pelo menos dois caracteres.').max(80)}).parse(req.query);
  try {
    const artworks=await searchArtworks(q);
    return res.json({artworks,source:'Art Institute of Chicago'});
  } catch(error) {
    console.warn('[Art Institute]',error.message);
    badRequest('ARTWORK_API_UNAVAILABLE','O catálogo externo está indisponível. Seus lotes publicados continuam funcionando.',503);
  }
}));
