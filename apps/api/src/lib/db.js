import './env.js';
import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient({ log: ['error', 'warn'] });

export async function serializable(work, attempts = 4) {
  for (let index = 0; index < attempts; index++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 8000,
        timeout: 12000
      });
    } catch (error) {
      if (!['P2034', '40P01', '40001'].includes(error?.code) || index === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (index + 1) + Math.floor(Math.random() * 40)));
    }
  }
}

export async function lockAuction(tx, id) {
  await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function lockUser(tx, id) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
}
