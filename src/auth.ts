import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import bcrypt from 'bcryptjs';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
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
    }),
  ],
  callbacks: {
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
