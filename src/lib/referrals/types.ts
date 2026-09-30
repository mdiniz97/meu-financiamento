import { db } from '@/db';

export type ReferralTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
