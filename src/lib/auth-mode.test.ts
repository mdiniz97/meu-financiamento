import { describe, expect, it, vi, afterEach } from 'vitest';
import { emailLoginEnabled } from './auth-mode';

describe('emailLoginEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('libera login por email fora de produção', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(emailLoginEnabled()).toBe(true);
  });

  it('bloqueia login por email em produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(emailLoginEnabled()).toBe(false);
  });
});
