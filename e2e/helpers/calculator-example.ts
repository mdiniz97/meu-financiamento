import { type Locator, type Page } from '@playwright/test';

// Explicit scenario data for calculation tests. New forms remain zero in the app;
// empty-simulations.spec.ts deliberately does not use this helper.
const inputs: Record<string, string> = {
  principal: '100000000', annualRate: '10.5', months: '360', trMonthly: '0.17', insuranceMonthly: '10000',
  smartPrincipal: '100000000', smartRate: '10.5', smartTr: '0.17', smartSeguro: '10000',
  smartMaxMonths: '360', smartMaxPayment2: '1200000',
  affIncome: '2000000', affCap: '500000', affCash: '25000000', affCosts: '2000000',
  affMonths: '360', affRate: '10.5', affTr: '0.17', affInsurance: '10000',
  portPrincipal: '80000000', portMonths: '300', portTr: '0.17',
  portCurrentRate: '11.5', portNewRate: '9', portSeguro: '10000', portNewSeguro: '10000',
  metaSaldo: '40000000', metaPrazo: '360', metaTaxa: '10.5', metaAnos: '10',
  invSaldo: '50000000', invPrazo: '360', invTaxa: '10.5', invValor: '10000000', invSelic: '10.5',
  acImovel: '50000000', acEntrada: '10000000', acAluguel: '250000', acTaxa: '10.5',
  acSelic: '10.5', acVal: '4', acPrazo: '10', acPrazoFin: '30',
  conValor: '30000000', conPrazo: '240', conAdmin: '18', conTaxa: '10.5',
  ciValor: '30000000', ciPrazo: '240', ciAdmin: '18', ciSelic: '10.5',
  obraValue: '50000000', obraDown: '20', obraRate: '10.5',
  ccImovel: '50000000', ccEntrada: '20', ccExtras: '300000',
  budget: '1200000', 'p1-months': '360', 'p2-months': '360', 'p3-months': '360',
  'p1-tr': '0.17', 'p2-tr': '0.17', 'p3-tr': '0.17',
};

const registeredPages = new WeakSet<Page>();

export async function seedCalculatorExample(page: Page, scope: Page | Locator = page) {
  if (!registeredPages.has(page)) {
    registeredPages.add(page);
    if (new URL(page.url()).pathname === '/nova-simulacao') {
      // Decline the newly registered account's offer before opening selects.
      const offer = page.getByRole('dialog', { name: 'Ative grátis 7 dias do Ilimitado' });
      await offer.getByRole('button', { name: 'Agora não', exact: true }).click();
      await offer.waitFor({ state: 'hidden' });
    }
    await page.addLocatorHandler(page.locator('[role="dialog"][data-open][aria-label="Ative grátis 7 dias do Ilimitado"]'), async dialog => {
      await dialog.getByRole('button', { name: 'Agora não', exact: true }).click();
    });
  }
  for (const [id, value] of Object.entries(inputs)) {
    // Income mode has no additional payment cap; payment mode uses R$ 5,000.
    if (id === 'affCap' && await scope.locator('#affIncome:visible').count()) continue;
    const field = scope.locator(`input[id="${id}"]:visible`);
    if (await field.count() !== 1) continue;
    if (/^(?:0|R\$\s*0,00|)$/.test(await field.inputValue())) {
      await field.fill(value);
      await field.blur();
    }
  }
  const delivery = scope.locator('#obraDelivery:visible');
  if (await delivery.count() && !(await delivery.inputValue())) {
    const date = new Date();
    date.setMonth(date.getMonth() + 24);
    await delivery.fill(date.toISOString().slice(0, 10));
  }
  for (const [id, value] of Object.entries({ bank: 'Caixa', smartBank: 'Caixa', affBank: 'Caixa', portBank: 'Caixa', portNewBank: 'Itaú', ccUf: 'SP - São Paulo' })) {
    const field = scope.locator(`[id="${id}"]:visible`);
    if (await field.count() !== 1) continue;
    if (await field.getAttribute('data-placeholder') !== null || /Selecione|^$/.test(((await field.textContent()) ?? '').replace(/\u200b/g, '').trim())) {
      await field.click();
      await page.getByRole('option', { name: value, exact: true }).click();
    }
  }
}

export async function gotoCalculatorExample(page: Page, path: string) {
  await page.goto(path);
  await seedCalculatorExample(page);
}
