import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: 'Email e senha (mín. 6 caracteres) são obrigatórios' },
      { status: 400 }
    );
  }
  const normalized = (email as string).toLowerCase();
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
      amount: 2,
      kind: 'bonus',
      description: 'Bônus de boas-vindas',
    });
    return created;
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
