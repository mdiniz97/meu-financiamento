import { db } from './index';
import { packs } from './schema';

async function main() {
  await db.insert(packs).values([
    { id: 'credits10', name: '10 créditos', priceCents: 1000, credits: 10, isSubscription: false },
    { id: 'unlimited', name: 'Ilimitado', priceCents: 9990, credits: null, isSubscription: true },
  ]).onConflictDoNothing();
  console.log('packs seeded');
}

void main();
