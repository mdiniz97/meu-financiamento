export const DEFAULT_PACKS = [
  { id: 'credits5', name: '5 créditos', priceCents: 1000, credits: 5, isSubscription: false },
  { id: 'unlimited', name: 'Ilimitado', priceCents: 11990, credits: null, isSubscription: true },
];

export async function seedPacks(client) {
  const values = DEFAULT_PACKS.flatMap((pack) => [
    pack.id,
    pack.name,
    pack.priceCents,
    pack.credits,
    pack.isSubscription,
  ]);

  await client.query(
    `INSERT INTO "packs" ("id", "name", "price_cents", "credits", "is_subscription")
     VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
     ON CONFLICT ("id") DO NOTHING`,
    values
  );
}
