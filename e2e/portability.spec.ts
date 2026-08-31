import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function cadastrarEAssinar(page: Page, prefix: string) {
  const email = `${prefix}${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const response = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
}

async function selecionarOpcao(page: Page, campo: string, opcao: string) {
  await page.getByRole('combobox', { name: campo, exact: true }).click();
  await page.getByRole('option', { name: opcao, exact: true }).click();
}

function computedColorIsTransparent(color: string) {
  if (color === 'transparent') return true;
  const alpha = color.match(/rgba?\([^)]*[,/]\s*(\d*\.?\d+%?)\s*\)$/)?.[1];
  if (alpha === undefined) return false;
  return alpha.endsWith('%') ? Number(alpha.slice(0, -1)) === 0 : Number(alpha) === 0;
}

async function expectCompleteBorder(locator: ReturnType<Page['getByRole']>) {
  const styles = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      styles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
      colors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
      boxShadow: style.boxShadow,
    };
  });
  expect(new Set(styles.widths)).toEqual(new Set(['1px']));
  expect(new Set(styles.styles)).toEqual(new Set(['solid']));
  expect(new Set(styles.colors).size).toBe(1);
  expect(computedColorIsTransparent(styles.colors[0])).toBe(false);
  expect(styles.boxShadow).toBe('none');
}

test('desktop mostra dados acima e painéis lado a lado', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-desktop');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/portabilidade');

  const data = page.getByRole('region', { name: /dados do financiamento/i });
  const current = page.getByRole('region', { name: 'Contrato atual', exact: true });
  const offered = page.getByRole('region', { name: 'Proposta oferecida', exact: true });
  await expect(data).toBeVisible();
  await expect(current).toBeVisible();
  await expect(offered).toBeVisible();

  expect((await data.boundingBox())!.y).toBeLessThan((await current.boundingBox())!.y);
  expect(Math.abs((await current.boundingBox())!.y - (await offered.boundingBox())!.y)).toBeLessThan(2);
  expect((await current.boundingBox())!.x).toBeLessThan((await offered.boundingBox())!.x);

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  const currentResult = page.getByRole('region', { name: 'Resultado do contrato atual' });
  const offeredResult = page.getByRole('region', { name: 'Resultado da proposta oferecida' });
  await expect(currentResult).toBeVisible();
  expect(Math.abs((await currentResult.boundingBox())!.y - (await offeredResult.boundingBox())!.y)).toBeLessThan(2);
  expect((await currentResult.boundingBox())!.x).toBeLessThan((await offeredResult.boundingBox())!.x);
});

test('controles e painéis de portabilidade têm geometria consistente no desktop', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-geometry');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/portabilidade');

  const current = page.getByRole('region', { name: 'Contrato atual', exact: true });
  const offered = page.getByRole('region', { name: 'Proposta oferecida', exact: true });
  const rateInput = page.getByRole('textbox', { name: 'Taxa atual', exact: true });
  const rateKind = page.getByRole('combobox', { name: 'Tipo de Taxa atual', exact: true });
  const [inputBox, selectBox] = await Promise.all([rateInput.boundingBox(), rateKind.boundingBox()]);
  expect(inputBox).not.toBeNull();
  expect(selectBox).not.toBeNull();
  expect(inputBox!.height).toBeCloseTo(32, 0);
  expect(selectBox!.height).toBeCloseTo(inputBox!.height, 0);
  expect(Math.abs(inputBox!.y + inputBox!.height - (selectBox!.y + selectBox!.height))).toBeLessThanOrEqual(1);

  const data = page.getByRole('region', { name: 'Dados do financiamento' });
  const principalBox = await data.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).boundingBox();
  const monthsBox = await data.getByRole('textbox', { name: 'Parcelas restantes' }).boundingBox();
  const trBox = await data.getByRole('textbox', { name: 'TR mensal (%)' }).boundingBox();
  expect(Math.max(principalBox!.y, monthsBox!.y, trBox!.y) - Math.min(principalBox!.y, monthsBox!.y, trBox!.y)).toBeLessThanOrEqual(1);

  for (const id of ['portCurrentSystem', 'portNewSystem']) {
    const header = page.locator(`[data-field-help-header="${id}"]`);
    const label = header.locator(`[data-field-help-label="${id}"]`);
    const help = page.locator(`[data-field-help-trigger="${id}"]`);
    const [headerBox, labelBox, helpBox] = await Promise.all([
      header.boundingBox(),
      label.boundingBox(),
      help.boundingBox(),
    ]);
    expect(headerBox!.height).toBeCloseTo(40, 0);
    expect(Math.abs(labelBox!.y - helpBox!.y)).toBeLessThanOrEqual(1);
    expect(helpBox!.y + helpBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height);
    const fieldset = page.locator(`fieldset[data-field-help-group="${id}"]`);
    await expect(fieldset).toHaveAccessibleName(id === 'portCurrentSystem' ? 'Sistema atual' : 'Novo sistema');
    const radioGroup = fieldset.getByRole('radiogroup');
    await expect(radioGroup).not.toHaveAttribute('aria-label');
  }

  const currentSystem = current.getByRole('radiogroup');
  const newSystem = offered.getByRole('radiogroup');
  const [currentSystemBox, newSystemBox] = await Promise.all([
    currentSystem.boundingBox(),
    newSystem.boundingBox(),
  ]);
  expect(Math.abs(currentSystemBox!.y - newSystemBox!.y)).toBeLessThanOrEqual(1);

  await expectCompleteBorder(current);
  await expectCompleteBorder(offered);

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expectCompleteBorder(page.getByRole('region', { name: 'Resultado do contrato atual' }));
  await expectCompleteBorder(page.getByRole('region', { name: 'Resultado da proposta oferecida' }));
});

test('painéis de portabilidade mantêm borda completa no mobile', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-border-mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portabilidade');

  await expectCompleteBorder(page.getByRole('region', { name: 'Contrato atual', exact: true }));
  await expectCompleteBorder(page.getByRole('region', { name: 'Proposta oferecida', exact: true }));
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expectCompleteBorder(page.getByRole('region', { name: 'Resultado do contrato atual' }));
  await expectCompleteBorder(page.getByRole('region', { name: 'Resultado da proposta oferecida' }));
});

test('detector de borda transparente cobre sintaxes CSS legada e moderna', () => {
  expect(computedColorIsTransparent('transparent')).toBe(true);
  expect(computedColorIsTransparent('rgba(0, 0, 0, 0)')).toBe(true);
  expect(computedColorIsTransparent('rgb(0 0 0 / 0)')).toBe(true);
  expect(computedColorIsTransparent('rgb(0 0 0 / 0%)')).toBe(true);
  expect(computedColorIsTransparent('rgba(0, 0, 0, 0.25)')).toBe(false);
  expect(computedColorIsTransparent('rgb(0 0 0 / 25%)')).toBe(false);
  expect(computedColorIsTransparent('oklab(0.5 0 0)')).toBe(false);
});

test('mobile empilha dados, contrato atual e proposta sem overflow horizontal', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portabilidade');

  const data = page.getByRole('region', { name: /dados do financiamento/i });
  const current = page.getByRole('region', { name: 'Contrato atual', exact: true });
  const offered = page.getByRole('region', { name: 'Proposta oferecida', exact: true });
  await expect(data).toBeVisible();

  const dataY = (await data.boundingBox())!.y;
  const currentY = (await current.boundingBox())!.y;
  const offeredY = (await offered.boundingBox())!.y;
  expect(dataY).toBeLessThan(currentY);
  expect(currentY).toBeLessThan(offeredY);

  await page.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).fill('9999999999999');
  await page.getByRole('textbox', { name: 'Custos da portabilidade (R$)' }).fill('9999999999999');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  const currentResult = page.getByRole('region', { name: 'Resultado do contrato atual' });
  const offeredResult = page.getByRole('region', { name: 'Resultado da proposta oferecida' });
  await expect(currentResult).toBeVisible();
  expect((await currentResult.boundingBox())!.y).toBeLessThan((await offeredResult.boundingBox())!.y);

  const grossCard = page.getByText('Economia bruta', { exact: true }).locator('..');
  const costsCard = page.getByText('Custos', { exact: true }).locator('..');
  expect((await grossCard.boundingBox())!.y).toBeLessThan((await costsCard.boundingBox())!.y);
  const currentPaymentCard = currentResult.getByText('Parcela inicial', { exact: true }).locator('..');
  const currentTotalCard = currentResult.getByText('Total futuro das parcelas', { exact: true }).locator('..');
  expect((await currentPaymentCard.boundingBox())!.y).toBeLessThan((await currentTotalCard.boundingBox())!.y);

  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  const sandboxOffered = page.getByRole('region', { name: /Portar para Itaú/ });
  await expect(sandboxOffered).toBeVisible();
  const offeredTotalCard = offeredResult.getByText('Total futuro combinado', { exact: true }).locator('..');
  const sandboxTotalCard = sandboxOffered.getByText('Total pago', { exact: true }).locator('..');
  for (const card of [costsCard, offeredTotalCard, sandboxTotalCard]) {
    expect(await card.evaluate((element) => getComputedStyle(element).minWidth)).toBe('0px');
    const value = card.locator('span').nth(1);
    expect(await value.evaluate((element) => getComputedStyle(element).overflowWrap)).toBe('anywhere');
  }
  expect(await sandboxOffered.evaluate((element) => getComputedStyle(element).minWidth)).toBe('0px');
  expect(
    await page.evaluate(() =>
      document.fonts.ready.then(() => document.documentElement.scrollWidth === window.innerWidth)
    )
  ).toBe(true);
});

test('cálculo continua funcional após reorganização', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-calc');
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena|não vale a pena/i).first()).toBeVisible();
});

test('comparação lado a lado da portabilidade tem borda completa nos cenários', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-sandbox-border');
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  await expect(page.getByRole('region', { name: /manter no/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /portar para/i })).toBeVisible();

  for (const name of [/manter no/i, /portar para/i]) {
    const styles = await page.getByRole('region', { name }).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        widths: [computed.borderTopWidth, computed.borderRightWidth, computed.borderBottomWidth, computed.borderLeftWidth],
        styles: [computed.borderTopStyle, computed.borderRightStyle, computed.borderBottomStyle, computed.borderLeftStyle],
        colors: [computed.borderTopColor, computed.borderRightColor, computed.borderBottomColor, computed.borderLeftColor],
      };
    });
    expect(new Set(styles.widths)).toEqual(new Set(['1px']));
    expect(new Set(styles.styles)).toEqual(new Set(['solid']));
    expect(computedColorIsTransparent(styles.colors[0])).toBe(false);
  }
});

test('erro de validação aparece na seção do campo inválido', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-validation');
  await page.goto('/portabilidade');

  const currentSection = page.getByRole('region', { name: /contrato atual/i });
  const dataSection = page.getByRole('region', { name: /dados do financiamento/i });

  const currentRate = page.getByRole('textbox', { name: 'Taxa atual', exact: true });
  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });

  await expect(async () => {
    await currentRate.fill('-');
    await expect(currentRate).toHaveAttribute('aria-invalid', 'true');
  }).toPass();
  await compare.evaluate((button: HTMLButtonElement) => button.click());
  await expect(currentSection.getByText('Informe uma taxa atual válida.')).toBeVisible();
  await expect(dataSection.getByText('Informe uma taxa atual válida.')).toHaveCount(0);
  await currentRate.blur();
  await expect(currentRate).toHaveValue('11.5');

  await page.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).fill('0');
  await compare.click();
  await expect(
    dataSection.getByText('Informe o saldo devedor atual (maior que zero).')
  ).toBeVisible();
});

test('busca inteligente mostra sem taxa viável quando nem 0% compensa', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-degenerate');
  await page.goto('/portabilidade');

  await page.getByRole('textbox', { name: 'Custos da portabilidade (R$)' }).fill('999999999');
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' }).fill('400000');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(page.getByText(/sem taxa viável/i)).toBeVisible();
  const combinedUnavailable = page.getByText(/parcela desejada é alcançável, mas nenhuma taxa também compensa portar/i);
  await expect(combinedUnavailable).toBeVisible();
  await expect(combinedUnavailable).not.toContainText(/% a\.a\./i);
  await expect(page.getByText(/taxa necessária para a sua parcela desejada/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toHaveCount(0);
});

test('busca inteligente omite parcela-alvo sem alvo e mostra impossível fora do alcance', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-target');
  await page.goto('/portabilidade');

  const smart = page.getByRole('region', { name: /busca inteligente/i });
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();
  await expect(smart.getByText(/taxa necessária para a sua parcela desejada/i)).toHaveCount(0);
  await expect(smart.getByText(/parcela desejada impossível/i)).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' }).fill('1');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(smart.getByText(/parcela desejada impossível/i)).toBeVisible();
});

test('parcela-alvo zero é tratada como opcional ausente', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-smart-valid');
  await page.goto('/portabilidade');

  const smart = page.getByRole('region', { name: /busca inteligente/i });
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' }).fill('0');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(smart.getByText('Informe uma parcela desejada maior que zero.')).toHaveCount(0);
  await expect(smart.getByText(/taxa necessária para a sua parcela desejada/i)).toHaveCount(0);

  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await expect(smart.getByText('Informe uma parcela desejada maior que zero.')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await expect(smart.getByText('Informe uma parcela desejada maior que zero.')).toHaveCount(0);
});

test('verdict usa economia líquida: custos acima da bruta → não vale a pena com detalhamento', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-verdict-cost');
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Custos da portabilidade (R$)' }).fill('999999999');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();

  await expect(page.getByText(/não vale a pena portar/i)).toBeVisible();
  await expect(page.getByText('Economia bruta', { exact: true })).toBeVisible();
  await expect(page.getByText('Custos', { exact: true })).toBeVisible();
  const liquida = page.getByText('Economia líquida', { exact: true });
  await expect(liquida).toBeVisible();
  await expect(liquida.locator('..')).toContainText('-');
  await expect(page.getByText('custos não recuperados no prazo', { exact: true })).toBeVisible();
  await expect(page.getByText(/primeira parcela/i)).toHaveCount(0);

  const currentResult = page.getByRole('region', { name: 'Resultado do contrato atual' });
  const offeredResult = page.getByRole('region', { name: 'Resultado da proposta oferecida' });
  await expect(currentResult).toBeVisible();
  await expect(offeredResult).toBeVisible();
  const offeredTotalCard = offeredResult.getByText('Total futuro combinado', { exact: true }).locator('..');
  const offeredTotal = await offeredTotalCard.locator('span').nth(1).textContent();

  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  await expect(page.getByText(/portar reduz o total pago/i)).toHaveCount(0);
  await expect(page.getByText(/manter no banco atual é/i)).toBeVisible();
  const sandboxOffered = page.getByRole('region', { name: /portar para/i });
  await expect(sandboxOffered.getByText('Total pago', { exact: true }).locator('..')).toContainText(
    offeredTotal!
  );
});

test('editar proposta após calcular marca resultado desatualizado e bloqueia ações até recalcular', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-dirty');
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  const levar = page.getByRole('button', { name: 'Levar para o simulador' });
  await expect(levar).toBeEnabled();

  const newRate = page.getByRole('textbox', { name: 'Nova taxa', exact: true });
  await newRate.fill('-');
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });
  await expect(warning).toHaveText('Dados alterados — calcule novamente');
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await expect(levar).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Ocultar comparação' })).toBeDisabled();

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).evaluate(
    (button: HTMLButtonElement) => button.click()
  );
  await expect(page.getByText('Informe uma nova taxa válida.')).toBeVisible();
  await expect(warning).toHaveText('Dados alterados — calcule novamente');
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await expect(levar).toBeDisabled();

  await newRate.blur();
  await expect(newRate).toHaveValue('9');
  await newRate.focus();
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText('Informe uma nova taxa válida.')).toHaveCount(0);
  await expect(warning).toHaveCount(0);
  await expect(levar).toBeEnabled();

  await newRate.fill('14');
  await expect(warning).toBeVisible();
  await expect(levar).toBeDisabled();
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(warning).toHaveCount(0);
  await expect(levar).toBeEnabled();
});

test('edições não-taxa e da busca inteligente invalidam comparação e busca anterior', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-stale-smart');
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });
  await expect(warning).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver comparação lado a lado' })).toBeDisabled();

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(warning).toHaveCount(0);
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(page.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Novo seguro (R$/mês)' }).fill('20000');
  await expect(warning).toBeVisible();
  await expect(page.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(warning).toHaveCount(0);
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(page.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' }).fill('400000');
  await expect(warning).toBeVisible();
  await expect(page.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
});

test('sintaxe inválida em prazo e TR recupera validade ao reverter no blur', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-invalid-shared');
  await page.goto('/portabilidade');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  const data = page.getByRole('region', { name: 'Dados do financiamento' });
  const smart = page.getByRole('region', { name: 'Busca inteligente' });
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });

  await compare.click();
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await compare.click();
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();

  const months = page.getByRole('textbox', { name: 'Parcelas restantes' });
  await months.fill('abc');
  await expect(warning).toHaveText('Dados alterados — calcule novamente');
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await compare.evaluate((button: HTMLButtonElement) => button.click());
  await expect(data.getByText('Parcelas restantes entre 1 e 600.')).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(months).toHaveValue('abc');

  await months.blur();
  await expect(months).toHaveValue('300');
  await months.focus();
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(data.getByText('Parcelas restantes entre 1 e 600.')).toHaveCount(0);
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();

  const tr = page.getByRole('textbox', { name: 'TR mensal (%)' });
  await tr.fill('abc');
  await expect(warning).toHaveText('Dados alterados — calcule novamente');
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
  await compare.evaluate((button: HTMLButtonElement) => button.click());
  await expect(data.getByText('Informe uma TR mensal válida.')).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(tr).toHaveValue('abc');

  await tr.blur();
  await expect(tr).toHaveValue('0.17');
  await tr.focus();
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(data.getByText('Informe uma TR mensal válida.')).toHaveCount(0);
});

test('campo numérico vazio emite zero: prazo falha e TR recalcula', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-empty-shared');
  await page.goto('/portabilidade');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  const data = page.getByRole('region', { name: 'Dados do financiamento' });
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });
  await compare.click();

  const months = page.getByRole('textbox', { name: 'Parcelas restantes' });
  await months.fill('');
  await expect(months).toHaveValue('');
  await months.blur();
  await expect(months).toHaveValue('0');
  await compare.click();
  await expect(data.getByText('Parcelas restantes entre 1 e 600.')).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();

  await months.fill('300');
  await compare.click();
  await expect(warning).toHaveCount(0);

  const tr = page.getByRole('textbox', { name: 'TR mensal (%)' });
  await tr.fill('');
  await expect(tr).toHaveValue('');
  await tr.blur();
  await expect(tr).toHaveValue('0');
  await compare.click();
  await expect(data.getByText('Informe uma TR mensal válida.')).toHaveCount(0);
  await expect(warning).toHaveCount(0);
});

test('taxa inválida atual ou oferecida descarta a busca inteligente', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-invalid-rate-smart');
  await page.goto('/portabilidade');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  const smart = page.getByRole('region', { name: 'Busca inteligente' });
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });

  await compare.click();
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await compare.click();

  for (const [field, controlledValue, error] of [
    ['Nova taxa', '9', 'Informe uma nova taxa válida.'],
    ['Taxa atual', '11.5', 'Informe uma taxa atual válida.'],
  ] as const) {
    await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
    await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();
    const rate = page.getByRole('textbox', { name: field, exact: true });
    await rate.fill('-');
    await expect(warning).toBeVisible();
    await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
    await expect(smart.getByRole('button', { name: 'Aplicar', exact: true })).toHaveCount(0);
    await compare.evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByText(error)).toBeVisible();
    await expect(rate).toHaveValue('-');
    await rate.blur();
    await expect(rate).toHaveValue(controlledValue);
    await rate.focus();
    await compare.click();
    await expect(page.getByText(error)).toHaveCount(0);
    await expect(warning).toHaveCount(0);
  }
});

test('banco, sistema e tipo de taxa invalidam e limpam busca independentemente', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-snapshot');
  await page.goto('/portabilidade');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  const smart = page.getByRole('region', { name: 'Busca inteligente' });
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });
  const transfer = page.getByRole('button', { name: 'Levar para o simulador' });
  const prepareSmartResult = async () => {
    await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
    await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toBeVisible();
  };

  await page.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).fill('90000000');
  await page.getByRole('textbox', { name: 'Parcelas restantes' }).fill('240');
  await compare.click();
  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await compare.click();
  await expect(page.getByRole('region', { name: 'Manter no Caixa (PRICE)', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Portar para Itaú (PRICE a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();

  const offered = page.getByRole('region', { name: 'Proposta oferecida', exact: true });
  await prepareSmartResult();
  await selecionarOpcao(page, 'Novo banco', 'Bradesco');
  await expect(warning).toBeVisible();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
  await expect(transfer).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Itaú (PRICE a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(transfer).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Bradesco (PRICE a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();

  await prepareSmartResult();
  await offered.getByRole('radio', { name: 'SAC', exact: true }).click();
  await expect(warning).toBeVisible();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
  await expect(transfer).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Bradesco (PRICE a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(transfer).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Bradesco (SAC a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();

  await prepareSmartResult();
  await selecionarOpcao(page, 'Tipo de Nova taxa', 'Nominal a.a.');
  await expect(warning).toBeVisible();
  await expect(smart.getByText(/taxa máxima que ainda compensa portar/i)).toHaveCount(0);
  await expect(transfer).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Bradesco (SAC a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(transfer).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Portar para Bradesco (SAC a 9,38% a.a. efetivos)', exact: true })
  ).toBeVisible();

  await Promise.all([page.waitForURL(/nova-simulacao/), transfer.click()]);
  expect(await page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem('nova-simulacao-prefill'))
  ).toBeNull();
  const wizard = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Simular', exact: true }),
  });
  expect(
    Number(await wizard.getByRole('textbox', { name: 'Taxa de juros' }).inputValue())
  ).toBeCloseTo(9.38069, 4);
  await expect(wizard.getByRole('combobox', { name: 'Banco', exact: true })).toContainText('Bradesco');
  await expect(wizard.getByRole('radio', { name: /^SAC/ })).toBeChecked();
});

test('transfere proposta completa e bloqueia transferência suja', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-transfer');
  await page.goto('/portabilidade');
  const prefillKey = 'nova-simulacao-prefill';
  const genericSentinel = JSON.stringify({
    system: 'PRICE',
    principal: '432100,00',
    annualRate: '7.25',
    annualRateKind: 'effective-annual',
    months: '180',
    trMonthly: '0.1',
    insuranceMonthly: '321,00',
    bank: 'Santander',
    lumpSum: [{ month: 12, amount: 5000 }],
    extraMonthlyPct: '5',
    extraMonthlyPctStart: '2',
    extraMonthlyPctUntil: '120',
    fixedPaymentStart: '',
    fgtsAnnual: '10000,00',
    fgtsStartMonth: '12',
    fgtsUntilMonth: '120',
    recurringExtra: { amount: '3000,00', every: '6', startMonth: '3', untilMonth: '120' },
    fixedPayment: '',
    fixedPaymentUntil: '',
    paySacParcela: true,
    reduceMode: 'payment',
    portability: null,
  });
  await page.evaluate(({ genericSentinel, prefillKey }) => {
    sessionStorage.setItem('sim-input', genericSentinel);
    sessionStorage.removeItem(prefillKey);
  }, { genericSentinel, prefillKey });

  const offered = page.getByRole('region', { name: 'Proposta oferecida', exact: true });
  await page.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).fill('87654321');
  await page.getByRole('textbox', { name: 'Parcelas restantes' }).fill('240');
  await page.getByRole('textbox', { name: 'TR mensal (%)' }).fill('0.23');
  await selecionarOpcao(page, 'Novo banco', 'Itaú');
  await offered.getByRole('radio', { name: 'SAC', exact: true }).click();
  await selecionarOpcao(page, 'Tipo de Nova taxa', 'Nominal a.a.');
  await page.getByRole('textbox', { name: 'Nova taxa', exact: true }).fill('12');
  await page.getByRole('textbox', { name: 'Novo seguro (R$/mês)' }).fill('34567');
  const costs = page.getByRole('textbox', { name: 'Custos da portabilidade (R$)' });
  await costs.fill('1234567');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  await compare.click();
  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  const transfer = page.getByRole('button', { name: 'Levar para o simulador' });
  await expect(transfer).toBeEnabled();

  await costs.fill('2345678');
  await expect(transfer).toBeDisabled();
  await transfer.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page).toHaveURL(/\/portabilidade$/);
  expect(await page.evaluate(() => sessionStorage.getItem('sim-input'))).toBe(genericSentinel);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), prefillKey)).toBeNull();

  await compare.click();
  await expect(transfer).toBeEnabled();
  await Promise.all([page.waitForURL(/\/nova-simulacao/), transfer.click()]);

  const wizard = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Simular', exact: true }),
  });
  const principal = wizard.getByRole('textbox', { name: 'Valor financiado (R$)' });
  const insurance = wizard.getByRole('textbox', { name: 'Seguro (R$/mês)' });
  const parseMoney = (value: string) =>
    Number(value.replace(/[^\d,-]/g, '').replace(',', '.'));
  await expect(principal).toBeVisible();
  expect(parseMoney(await principal.inputValue())).toBe(876543.21);
  expect(Number(await wizard.getByRole('textbox', { name: 'Taxa de juros' }).inputValue())).toBeCloseTo(
    12.682503,
    5
  );
  await expect(wizard.getByRole('combobox', { name: 'Tipo de Taxa de juros' })).toContainText(
    'Efetiva a.a.'
  );
  await expect(wizard.getByRole('textbox', { name: 'Prazo (meses)' })).toHaveValue('240');
  await expect(wizard.getByRole('textbox', { name: 'TR mensal (%)' })).toHaveValue('0.23');
  expect(parseMoney(await insurance.inputValue())).toBe(345.67);
  await expect(wizard.getByRole('combobox', { name: 'Banco', exact: true })).toContainText('Itaú');
  await expect(wizard.getByRole('radio', { name: /^SAC/ })).toBeChecked();

  expect(await page.evaluate(() => sessionStorage.getItem('sim-input'))).toBe(genericSentinel);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), prefillKey)).toBeNull();

  await Promise.all([
    page.waitForURL(/\/simulacao/),
    wizard.getByRole('button', { name: 'Simular', exact: true }).click(),
  ]);
  const transferredRaw = await page.evaluate(() => sessionStorage.getItem('sim-input'));
  expect(transferredRaw).not.toBeNull();
  const transferred = JSON.parse(transferredRaw!) as Record<string, unknown>;
  expect(transferred).toMatchObject({
    principal: '876543,21',
    system: 'SAC',
    bank: 'Itaú',
    annualRateKind: 'effective-annual',
    trMonthly: '0.23',
    insuranceMonthly: '345,67',
    months: '240',
    lumpSum: [],
    extraMonthlyPct: '0',
    extraMonthlyPctStart: '',
    extraMonthlyPctUntil: '',
    fixedPaymentStart: '',
    fgtsAnnual: '0',
    fgtsStartMonth: '12',
    fgtsUntilMonth: '',
    recurringExtra: null,
    fixedPayment: '',
    fixedPaymentUntil: '',
    paySacParcela: false,
    reduceMode: 'term',
    portability: null,
  });
  expect(Number(transferred.annualRate)).toBeCloseTo(12.682503, 5);
  expect(transferred).not.toHaveProperty('costs');

  await page.evaluate(({ genericSentinel, prefillKey }) => {
    sessionStorage.setItem('sim-input', genericSentinel);
    sessionStorage.removeItem(prefillKey);
  }, { genericSentinel, prefillKey });
  await page.goto('/nova-simulacao');

  const freshWizard = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Simular', exact: true }),
  });
  const freshPrincipal = freshWizard.getByRole('textbox', { name: 'Valor financiado (R$)' });
  const freshInsurance = freshWizard.getByRole('textbox', { name: 'Seguro (R$/mês)' });
  await expect(freshPrincipal).toBeVisible();
  expect(parseMoney(await freshPrincipal.inputValue())).toBe(1000000);
  await expect(freshWizard.getByRole('textbox', { name: 'Taxa de juros' })).toHaveValue('10.5');
  await expect(freshWizard.getByRole('combobox', { name: 'Tipo de Taxa de juros' })).toContainText(
    'Efetiva a.a.'
  );
  await expect(freshWizard.getByRole('textbox', { name: 'Prazo (meses)' })).toHaveValue('360');
  await expect(freshWizard.getByRole('textbox', { name: 'TR mensal (%)' })).toHaveValue('0.17');
  expect(parseMoney(await freshInsurance.inputValue())).toBe(100);
  await expect(freshWizard.getByRole('combobox', { name: 'Banco', exact: true })).toContainText('Caixa');
  await expect(freshWizard.getByRole('radio', { name: /^PRICE/ })).toBeChecked();

  await Promise.all([
    page.waitForURL(/\/simulacao/),
    freshWizard.getByRole('button', { name: 'Simular', exact: true }).click(),
  ]);
  await expect(page.getByText('Nenhuma amortização definida.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Pagar como no SAC' })).not.toBeChecked();
});

test('TR inválida preserva resultado e metadados do cálculo anterior', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-engine-error');
  await page.goto('/portabilidade');

  const compare = page.getByRole('button', { name: 'Comparar contrato atual e proposta' });
  const warning = page.getByRole('alert').filter({ hasText: 'Dados alterados — calcule novamente' });
  await compare.click();
  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();

  await selecionarOpcao(page, 'Novo banco', 'Bradesco');
  await page.getByRole('textbox', { name: 'TR mensal (%)' }).fill('11');
  await compare.click();
  await expect(page.getByText(/TR mensal deve ficar entre 0% e 10%/i)).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Portar para Itaú (PRICE a 9,00% a.a. efetivos)', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Levar para o simulador' })).toBeDisabled();

  await page.getByRole('textbox', { name: 'TR mensal (%)' }).fill('0.17');
  await compare.click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByText(/TR mensal deve ficar entre 0% e 10%/i)).toHaveCount(0);
  await expect(page.getByRole('region', { name: /Portar para Bradesco/ })).toBeVisible();
});

test('economia líquida zero mostra empate neutro', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-neutral');
  await page.goto('/portabilidade');

  await page.getByRole('textbox', { name: 'Nova taxa', exact: true }).fill('11.5');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();

  const tie = page.getByText('Empate: manter e portar têm o mesmo custo total.', { exact: true });
  await expect(tie).toHaveCount(1);
  await expect(tie.locator('..')).toHaveClass(/bg-muted/);
  await expect(page.getByText(/mais barato que portar/i)).toHaveCount(0);
  await expect(page.getByText(/-R\$\s*0,00/)).toHaveCount(0);
  const netCard = page.getByText('Economia líquida', { exact: true }).locator('..');
  await expect(netCard).toContainText('R$ 0,00');
  await expect(netCard.locator('span').nth(1)).not.toHaveClass(/text-emerald|text-destructive/);

  await page.getByRole('button', { name: 'Ver comparação lado a lado' }).click();
  await expect(tie).toHaveCount(2);
  await expect(page.getByRole('region', { name: /Manter no Caixa/ })).not.toHaveClass(/ring-2/);
  await expect(page.getByRole('region', { name: /Portar para Itaú/ })).not.toHaveClass(/ring-2/);
});

test('busca permite limpar parcela alvo e aplicar taxa segura inclusive em 0%', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-safe-rate');
  await page.goto('/portabilidade');

  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  const target = page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' });
  await target.fill('400000');
  await target.fill('');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();
  await expect(page.getByText(/taxa necessária para a sua parcela desejada/i)).toHaveCount(0);

  const smart = page.getByRole('region', { name: 'Busca inteligente' });
  await smart.getByRole('button', { name: 'Aplicar', exact: true }).first().click();
  const offeredRate = page.getByRole('textbox', { name: 'Nova taxa', exact: true });
  const applied = Number(await offeredRate.inputValue());
  expect(Number.isFinite(applied)).toBe(true);
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena portar!|Empate: manter e portar/i)).toBeVisible();
  await expect(page.getByText(/não vale a pena portar/i)).toHaveCount(0);

  await offeredRate.fill('0');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText('Informe uma nova taxa válida.')).toHaveCount(0);
  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
});

test('parcela alvo no teto mostra exatamente a taxa combinada aplicada e segura', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-target-ceiling-copy');
  await page.goto('/portabilidade');

  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' }).fill('400000');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).click();

  const smart = page.getByRole('region', { name: 'Busca inteligente' });
  const targetRateCopy = smart.getByText(/taxa necessária para a sua parcela desejada/i).locator('..');
  const text = await targetRateCopy.textContent();
  const displayedRate = Number(text?.match(/([\d.,]+)% a\.a\./)?.[1].replace(',', '.'));
  expect(displayedRate).toBeLessThan(100);

  await targetRateCopy.getByRole('button', { name: 'Aplicar', exact: true }).click();
  const offeredRate = page.getByRole('textbox', { name: 'Nova taxa', exact: true });
  expect(Number(await offeredRate.inputValue())).toBeCloseTo(displayedRate, 12);
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena portar!|Empate: manter e portar/i)).toBeVisible();
  await expect(page.getByText(/não vale a pena portar/i)).toHaveCount(0);
});

test('TR acima de 10% falha na seção compartilhada antes do motor', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-tr-limit');
  await page.goto('/portabilidade');

  await page.getByRole('textbox', { name: 'TR mensal (%)' }).fill('10.01');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(
    page.getByRole('region', { name: 'Dados do financiamento' }).getByText('A TR mensal deve ficar entre 0% e 10%.')
  ).toBeVisible();
});

test('veredito descreve direção real da primeira parcela e resumo fica completo', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page, 'port-summary-direction');
  await page.goto('/portabilidade');

  await page.getByRole('textbox', { name: 'Saldo devedor atual (R$)' }).fill('30000000');
  await page.getByRole('textbox', { name: 'Parcelas restantes' }).fill('120');
  await page.getByRole('textbox', { name: 'Taxa atual', exact: true }).fill('3');
  await page.getByRole('textbox', { name: 'Nova taxa', exact: true }).fill('0');
  await page.getByRole('textbox', { name: 'Seguro atual (R$/mês)' }).fill('10000');
  await page.getByRole('textbox', { name: 'Novo seguro (R$/mês)' }).fill('50000');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();

  await expect(page.getByText(/vale a pena portar!/i)).toBeVisible();
  await expect(page.getByText(/primeira parcela fica maior/i)).toBeVisible();
  await expect(page.getByText(/parcela já cai a partir/i)).toHaveCount(0);

  const current = page.getByRole('region', { name: 'Resultado do contrato atual' });
  const offered = page.getByRole('region', { name: 'Resultado da proposta oferecida' });
  for (const label of ['Parcela inicial', 'Maior parcela', 'Total futuro das parcelas', 'Juros totais', 'Prazo restante']) {
    await expect(current.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of ['Parcela inicial', 'Maior parcela', 'Total futuro das parcelas', 'Custos da portabilidade', 'Total futuro combinado', 'Juros totais', 'Prazo proposto']) {
    await expect(offered.getByText(label, { exact: true })).toBeVisible();
  }
});
