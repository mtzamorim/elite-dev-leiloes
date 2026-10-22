import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { env } from './env.js';
import { badRequest, wrap } from './http.js';

export const userSafe = (user) => user ? ({ id:user.id, name:user.name, email:user.email, role:user.role, createdAt:user.createdAt }) : null;

export function tokenUser(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    return typeof payload === 'object' && payload?.sub ? payload.sub : null;
  } catch { return null; }
}

export function setSession(res, user) {
  const token = jwt.sign({}, env.jwtSecret, { algorithm: 'HS256', subject:user.id, expiresIn:'7d' });
  res.cookie('atelier_session', token, { httpOnly:true, secure:env.production, sameSite:'lax', maxAge:7*24*3600*1000, path:'/' });
}

export function clearSession(res) {
  res.clearCookie('atelier_session', { httpOnly:true, secure:env.production, sameSite:'lax', path:'/' });
}

export const optionalAuth = wrap(async (req, _res, next) => {
  const id = tokenUser(req.cookies?.atelier_session);
  req.user = id ? await prisma.user.findUnique({ where:{ id } }) : null;
  next();
});

export const requireAuth = (req, _res, next) => {
  if (!req.user) return next(badRequest('AUTH', 'Entre na sua conta para continuar.', 401));
  next();
};

export const requireRole = (role) => (req, _res, next) => {
  if (req.user?.role !== role) return next(badRequest('ROLE', `Esta ação exige o perfil ${role === 'BIDDER' ? 'licitante' : 'leiloeiro'}.`, 403));
  next();
};
