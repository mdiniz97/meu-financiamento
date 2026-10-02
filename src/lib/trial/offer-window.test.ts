import { expect, it } from 'vitest';
import { trialOfferDeadline } from './offer-window';

it('keeps normal signup deadline anchored to creation', () => {
  expect(trialOfferDeadline({ createdAt: new Date('2026-10-01T00:00:00Z'),
    trialOfferEligibleAt: new Date('2026-10-01T00:00:01Z') }))
    .toEqual(new Date('2026-10-03T00:00:00Z'));
});

it('allows explicitly granted offer on old account without rewriting creation', () => {
  expect(trialOfferDeadline({ createdAt: new Date('2026-09-22T00:00:00Z'),
    trialOfferEligibleAt: new Date('2026-10-02T12:00:00Z') }))
    .toEqual(new Date('2026-10-04T12:00:00Z'));
});

it('does not grant an offer to unmarked legacy accounts', () => {
  expect(trialOfferDeadline({ createdAt: new Date(), trialOfferEligibleAt: null })).toBeNull();
});
