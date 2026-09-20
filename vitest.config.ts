import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Os testes financeiros são CPU-bound (projeções de 360 parcelas, varreduras
    // centavo a centavo). Localmente cada caso leva ~0,5s, mas nos runners do CI
    // — CPU mais lenta e vários arquivos em paralelo — passavam dos 5s do default
    // do Vitest e falhavam por timeout, não por asserção. 30s dá folga sem
    // esconder loop infinito de verdade.
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
