# Modo Negociação

## Objetivo e escopo

Nova ferramenta `/negociacao` para o momento de maior tensão da jornada: a
negociação com o banco/corretor. Em vez de só simular, o app vira o roteiro da
conversa: diz se a proposta fecha dentro do orçamento e onde apertar (taxa,
entrada, prazo), com um script de negociação.

Ferramenta exclusiva do Ilimitado (mesmo padrão das demais ferramentas de
decisão, com `UpgradeCard` para quem não assina).

Dois modos:

- **Negociar** — o usuário tem uma proposta (valor financiado, taxa, prazo, TR,
  seguro, banco, sistema) e um **teto de parcela**. O app diz se cabe e calcula
  os limites aceitáveis: **taxa máxima**, **entrada mínima**, **prazo máximo**.
- **Descobrir** — o usuário informa só o teto de parcela e a entrada; o app acha
  o pacote (valor financiado + valor do imóvel) que cabe.

Fora de escopo nesta versão: salvar como contrato acompanhado, integração com
Open Finance, sinais externos (Selic/TR ao vivo além do já existente), cobrança
por resultado.

## Entradas

Contrato: `financedValue` (principal), `downPayment`, `annualRate` + `rateKind`,
`months`, `trMonthly`, `insuranceMonthly`, `bank`, `system` (`PRICE`/`SAC`).

Alvo: `maxPayment` (teto de parcela mensal).

- Modo Negociar: todos os campos do contrato + teto.
- Modo Descobrir: teto + `downPayment` (+ custos iniciais opcionais) → principal
  máximo e valor de imóvel.

Validação igual às demais libs (`normalizeRate`, faixas de prazo/TR/seguro),
mensagens no padrão do `WizardForm`.

## Motor — `src/lib/finance/negotiation.ts` (puro, testável)

Função principal, dado o contrato e o teto:

```ts
interface NegotiationResult {
  fits: boolean;                 // pico de parcela <= teto
  initialPayment: number;
  peakPayment: number;
  peakPaymentMonth: number;
  slackMonthly: number;          // teto - picoParcela (>= 0 quando cabe)
  maxAnnualRate: number | null;  // maior taxa em que pico <= teto (null se nem 0% cabe)
  minMonths: number;             // menor prazo em que pico <= teto
  maxPrincipal: number;          // maior principal cujo pico <= teto
  minDownPayment: number;        // valor - maxPrincipal (>= 0)
  maxPropertyValue: number;      // maxPrincipal + entrada atual
}
```

- `fits`, `initialPayment`, `peakPayment`, `peakPaymentMonth`, `slackMonthly`:
  derivados de `calculatePeakPayment`/`simulate`.
- `maxAnnualRate`: **busca binária** na taxa efetiva anual (parcela é monótona
  crescente na taxa) até `peakPayment ≈ teto`, dentro de uma faixa sã (0–100%);
  `null` quando nem a 0% cabe.
- `minMonths`: **busca binária** nos meses (1–600) pelo menor prazo em que o pico
  cabe no teto (prazo maior = parcela menor; negociar prazo menor economiza
  juros). Não existe limite de prazo "para cima" — maior prazo sempre cabe mais.
- `maxPrincipal`: maior principal cujo pico ≤ teto, via
  `calculateFinancingCapacity`.
- `minDownPayment` = `max(0, propertyValue - maxPrincipal)`;
  `maxPropertyValue` = `maxPrincipal + max(0, propertyValue - principal)`.

Reusa `simulate`, `calculatePeakPayment` e, no modo Descobrir,
`calculateFinancingCapacity`. Não reimplementa matemática financeira.

Regra: o critério é **pico de parcela ≤ teto** (não apenas a 1ª parcela), igual
ao restante do app (SAC/PRICE, TR, seguro incluídos).

## UI — `/negociacao`

- Página server: `auth()` → login; gating Ilimitado (`getCreditBalance`) →
  `UpgradeCard` se não assina; render do client.
- Client com abas **Negociar / Descobrir**, inputs ao vivo (muda taxa/entrada →
  parcela e veredito recalculam na hora).
- Resultado: **semáforo** (fecha / no limite / não fecha), parcela inicial e pico,
  folga mensal, e os limites (`taxa máxima`, `entrada mínima`, `prazo mínimo
  viável`).
- **Script** gerado em texto a partir dos limites: ex. "peça taxa ≤ 9,80% a.a. ou
  entrada ≥ R$ 80.000; prazo máx. 360 meses".
- Botão **Salvar oferta** e lista das ofertas salvas com **comparação lado a
  lado** (mesmo estilo da tabela comparativa).

## Persistência

Reusa `saveToolSimulation` com `system: 'negociacao'` e `charge: false`, gravando
na tabela `simulations` existente. Lista = `simulations` do usuário com
`system = 'negociacao'`. **Sem migração de banco.**

## Navegação, gating e analytics

- Item na sidebar (`/negociacao`, ícone `Handshake`/`Scale`).
- Exclusivo Ilimitado (UpgradeCard para não assinantes), como as outras
  ferramentas.
- `captureCtaClick`/`captureAccountEvent` no salvamento e no upgrade.

## Erros e casos-limite

- Teto ≤ seguro mensal → veredito "não fecha" com prazo/taxa máximos 0.
- Taxa/prazo fora de faixa → mensagem de validação, sem cálculo.
- `system` inválido → normaliza/recusa como no restante (allowlist PRICE/SAC).

## Testes

- **Unit `negotiation.test.ts`**: monotonicidade (parcela cresce com a taxa),
  `maxAnnualRate` faz pico ≈ teto, `maxMonths` idem, `minDownPayment`,
  SAC vs PRICE, com TR/seguro, casos-limite (teto baixo, entrada 0).
- **e2e**: assinar (fake) → `/negociacao` → informar teto → veredito e limites →
  salvar oferta → aparece na lista; e caso "não fecha".
- `tsc`, lint, build.

## Provas antes de publicar

- Motor puro com testes cobrindo monotonicidade e limites exatos.
- Gating: não assinante vê upgrade; assinante usa.
- Salvar/listar/comparar sem migração e sem consumir créditos.
- Suíte completa, TypeScript, lint, build e e2e verdes; commit só do escopo.
