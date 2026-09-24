import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { Provider } from 'next-auth/providers';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db, schema } from '@/db';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { sendWelcomeEmail, WELCOME_BONUS_CREDITS } from '@/lib/email/notify';
import { captureAccountEvent } from '@/lib/analytics/server';

const providers: Provider[] = [];

if (emailLoginEnabled()) {
  providers.push(
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, String(creds.email ?? '').toLowerCase()),
        });
        if (!user) return null;
        const ok = await bcrypt.compare(String(creds.password ?? ''), user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    })
  );
}

// Em produção o login é somente Google: cada conta Google vira um usuário
// local (2 créditos de bônus só na primeira criação) e o id da sessão é o
// UUID local, preservando créditos, simulações e assinatura.
providers.push(Google);

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase();
        if (!email) return false;
        const existing = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });
        if (existing) {
          user.id = existing.id;
          return true;
        }
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(schema.users)
            .values({
              name: user.name ?? email.split('@')[0],
              email,
              passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
            })
            .returning();
          await tx.insert(schema.creditLedger).values({
            userId: row.id,
            amount: WELCOME_BONUS_CREDITS,
            kind: 'bonus',
            description: 'Bônus de boas-vindas',
          });
          return row;
        });
        user.id = created.id;
        // Best-effort: nunca lança. Este é o ÚNICO caminho de cadastro em
        // produção (login por e-mail está desligado lá).
        await sendWelcomeEmail({ name: created.name, email: created.email });
        await captureAccountEvent(created.id, 'signup_completed', created.id);
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      session.userId = (token.userId as string) ?? session.user?.email ?? '';
      return session;
    },
  },
});
