import { describe, expect, it, vi } from 'vitest';
import { dispatchSignupConversion } from './dispatch-signup-conversion';

const PENDING = {
  transactionId: 'TID_42',
  claimToken: '611a98f0-bb03-447e-a0e5-e55492c60c4f',
};

describe('Google Ads signup conversion dispatcher', () => {
  it('does not reserve a conversion without gtag', async () => {
    const claim = vi.fn().mockResolvedValue(PENDING);
    await dispatchSignupConversion(undefined, claim, vi.fn());
    expect(claim).not.toHaveBeenCalled();
  });

  it('does not send an event when account has no pending signup', async () => {
    const gtag = vi.fn();
    await dispatchSignupConversion(gtag, vi.fn().mockResolvedValue(null), vi.fn());
    expect(gtag).not.toHaveBeenCalled();
  });

  it('uses the assigned conversion and acknowledges only after a Google callback', async () => {
    const gtag = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    await dispatchSignupConversion(gtag, vi.fn().mockResolvedValue(PENDING), ack);

    expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({
      send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
      value: 1.0,
      currency: 'BRL',
      transaction_id: 'TID_42',
    }));
    const payload = gtag.mock.calls[0][2] as { event_callback: () => void };
    expect(Object.keys(payload).sort()).toEqual(['currency', 'event_callback', 'send_to', 'transaction_id', 'value']);
    expect(ack).not.toHaveBeenCalled();

    payload.event_callback();
    payload.event_callback();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledWith(PENDING.claimToken);
  });

  it('does not acknowledge when the tag rejects a conversion call', async () => {
    const ack = vi.fn();
    await expect(dispatchSignupConversion(() => { throw new Error('blocked'); },
      vi.fn().mockResolvedValue(PENDING), ack)).rejects.toThrow('blocked');
    expect(ack).not.toHaveBeenCalled();
  });
});
