import './env.js';
import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient({ log: ['error', 'warn'] });

// O PostgreSQL pode abortar uma transação Serializable concorrente (SQLSTATE 40001).
// Quando o conflito ocorre em $queryRaw, o Prisma encapsula o SQLSTATE em P2010/meta.code.
export function isRetryableTransactionError(error) {
  if (error?.code === 'P2034' || ['40001', '40P01'].includes(error?.code)) return true;
  return error?.code === 'P2010' && ['40001', '40P01'].includes(error?.meta?.code);
}

// Reexecutar toda a transação garante que os saldos e o estado do lote sejam relidos.
export async function withTransactionRetry(execute, attempts = 4) {
  for (let index = 0; index < attempts; index++) {
    try {
      return await execute();
    } catch (error) {
      if (!isRetryableTransactionError(error) || index === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (index + 1) + Math.floor(Math.random() * 40)));
    }
  }
}

export function serializable(work, attempts = 4) {
  return withTransactionRetry(() => prisma.$transaction(work, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 8000,
    timeout: 12000
  }), attempts);
}

export async function lockAuction(tx, id) {
  await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function lockUser(tx, id) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
}
