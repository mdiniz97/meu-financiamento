import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export const newReferralCode = () => randomBytes(16).toString('base64url');

export function maskReferralEmail(email: string): string {
  const [local = '', domain = ''] = email.toLowerCase().split('@');
  const parts = local.split('.');
  const maskedLocal = parts.map((part, index) => {
    if (part.length < 4) return '*';
    return `${part.slice(0, index === 0 ? 2 : 3)}${index === 0 ? '***' : '**'}`;
  }).join('.');
  const suffix = domain.split('.').at(-1);
  return `${maskedLocal}@***.${suffix && suffix.length >= 2 ? suffix : '**'}`;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db.update(schema.users)
        .set({ referralCode: sql`coalesce(${schema.users.referralCode}, ${newReferralCode()})` })
        .where(eq(schema.users.id, userId))
        .returning({ code: schema.users.referralCode });
      if (!row?.code) throw new Error('Conta não encontrada');
      return row.code;
    } catch (error) {
      if ((error as { code?: string }).code !== '23505' || attempt === 2) throw error;
    }
  }
  throw new Error('Código indisponível');
}
