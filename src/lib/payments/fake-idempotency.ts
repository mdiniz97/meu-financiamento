// Idempotência opcional do GET fake (dev-only): tokens em memória, sem coluna
// no banco; reiniciar o processo limpa. Aceitável: ambiente de dev/teste.
// Não usar em produção — o fluxo POST real idempotente é o providerId.
const fakeIdempotencyTokens = new Map<string, string>();

export function recordFakeIdempotencyToken(key: string, token: string): void {
  fakeIdempotencyTokens.set(key, token);
}

export function hasFakeIdempotencyToken(key: string, token: string): boolean {
  return fakeIdempotencyTokens.get(key) === token;
}

export function __resetFakeIdempotencyForTests(): void {
  fakeIdempotencyTokens.clear();
}
