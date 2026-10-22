import { ZodError } from 'zod';
import { DomainError } from '../domain/rules.js';

export const wrap = (action) => (req, res, next) => Promise.resolve(action(req, res, next)).catch(next);
export const respond = (res, data, status = 200) => res.status(status).json(data);
export const badRequest = (code, message, status = 400) => { throw new DomainError(code, message, status); };

export function errorHandler(err, _req, res, _next) {
  if (err instanceof DomainError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err instanceof ZodError) return res.status(422).json({ error: { code: 'VALIDATION', message: err.issues.map(i => i.message).join(' | ') } });
  if (err?.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Registro já existe.' } });
  if (err?.code === 'P2034') return res.status(409).json({ error: { code: 'CONFLICT', message: 'Operação concorrente. Tente novamente.' } });
  console.error('[api:erro]', err);
  return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Não foi possível concluir a operação.' } });
}
