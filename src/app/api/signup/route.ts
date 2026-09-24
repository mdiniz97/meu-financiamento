import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import bcrypt from 'bcryptjs';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { sendWelcomeEmail, WELCOME_BONUS_CREDITS } from '@/lib/email/notify';

export async function POST(req: Request) {
  if (!emailLoginEnabled()) {
    return NextResponse.json({ error: 'Cadastro por email indisponível' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }
  const { name, email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
  }
  if (typeof email !== 'string' || email.length === 0 || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json(
      { error: 'Email e senha (mín. 6 caracteres) são obrigatórios' },
      { status: 400 }
    );
  }
  const normalized = email.toLowerCase();
  const exists = await db.query.users.findFirst({
    where: eq(schema.users.email, normalized),
  });
  if (exists)
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({
        name,
        email: normalized,
        passwordHash: await bcrypt.hash(password, 10),
      })
      .returning();
    await tx.insert(schema.creditLedger).values({
      userId: created.id,
      amount: WELCOME_BONUS_CREDITS,
      kind: 'bonus',
      description: 'Bônus de boas-vindas',
    });
    return created;
  });

  // Best-effort: o cadastro já está feito e não pode falhar porque o e-mail não
  // saiu. `sendWelcomeEmail` nunca lança.
  await sendWelcomeEmail({ name: user.name, email: user.email });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
