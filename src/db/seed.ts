import { db } from './index';
import { packs } from './schema';
import { DEFAULT_PACKS } from '../../scripts/seed-packs.mjs';

async function main() {
  await db.insert(packs).values(DEFAULT_PACKS).onConflictDoNothing();
  console.log('packs seeded');
}

void main();
