import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Os scripts do workspace da API executam com cwd=apps/api;
// carregar explicitamente o .env do monorepo evita depender do diretorio de execucao.
export const projectRoot=fileURLToPath(new URL('../../../../',import.meta.url));
loadEnv({path:path.join(projectRoot,'.env')});
const anchorSetting=process.env.AUDIT_ANCHOR_FILE || 'storage/audit-anchors.ndjson';
export const env = {
  port:Number(process.env.PORT || 3001),
  production:process.env.NODE_ENV === 'production',
  jwtSecret:process.env.JWT_SECRET || '',
  auditSecret:process.env.AUDIT_SECRET || '',
  anchorFile:path.isAbsolute(anchorSetting)?anchorSetting:path.resolve(projectRoot,anchorSetting)
};

export function assertConfiguration() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurado. Consulte .env.example.');
  if (env.jwtSecret.length < 32 || env.auditSecret.length < 32) throw new Error('JWT_SECRET e AUDIT_SECRET devem ter pelo menos 32 caracteres.');
  if (env.jwtSecret === env.auditSecret) throw new Error('Use segredos diferentes para JWT e auditoria.');
  if (env.production && (env.jwtSecret.startsWith('CHANGE_') || env.auditSecret.startsWith('CHANGE_'))) throw new Error('Não utilize os segredos de exemplo em produção.');
}
