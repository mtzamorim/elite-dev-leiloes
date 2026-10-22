import 'dotenv/config';
import path from 'node:path';

export const env = {
  port: Number(process.env.PORT || 3001),
  production: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || '',
  auditSecret: process.env.AUDIT_SECRET || '',
  anchorFile: path.resolve(process.env.AUDIT_ANCHOR_FILE || './storage/audit-anchors.ndjson')
};

export function assertConfiguration() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurado. Consulte .env.example.');
  if (env.jwtSecret.length < 32 || env.auditSecret.length < 32) throw new Error('JWT_SECRET e AUDIT_SECRET devem ter pelo menos 32 caracteres.');
  if (env.jwtSecret === env.auditSecret) throw new Error('Use segredos diferentes para JWT e auditoria.');
  if (env.production && (env.jwtSecret.startsWith('CHANGE_') || env.auditSecret.startsWith('CHANGE_'))) {
    throw new Error('Não utilize os segredos de exemplo em produção.');
  }
}
