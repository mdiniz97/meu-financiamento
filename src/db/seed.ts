import { db } from './index';
import { packs } from './schema';

async function main() {
  await db.insert(packs).values([
    { id: 'credits5', name: '5 créditos', priceCents: 1000, credits: 5, isSubscription: false },
    { id: 'unlimited', name: 'Ilimitado', priceCents: 11990, credits: null, isSubscription: true },
  ]).onConflictDoNothing();
  console.log('packs seeded');
}

void main();
