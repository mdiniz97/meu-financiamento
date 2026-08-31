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

async function cadastrarIlimitado(page: Page) {
  const email = `help-coverage-${Date.now()}-${crypto.randomUUID()}@teste.com`;
  await page.goto('/cadastro');
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

type Concept = { id: string; label: string; selector?: string };

const escapeId = (id: string) => id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

async function auditVisibleEditableControls(page: Page) {
  const groupMarkers = page.locator('[data-field-help-group]');
  for (let index = 0; index < await groupMarkers.count(); index += 1) {
    const group = groupMarkers.nth(index);
    const conceptId = await group.getAttribute('data-field-help-group');
    expect(await group.evaluate((element) => element.tagName), `grupo ${conceptId} deve ser fieldset`).toBe('FIELDSET');
    expect(await group.getAttribute('id'), `grupo ${conceptId} deve ser gerado para o mesmo conceito`).toBe(conceptId);
    expect(await group.locator(':scope > legend').count(), `grupo ${conceptId} sem legend direto`).toBe(1);
    expect(await group.locator(':scope > legend [data-field-help-trigger]').count(), `legend de ${conceptId} contém trigger interativo`).toBe(0);
  }

  const controls = page.locator(
    'input:not([type="hidden"]):not([aria-hidden="true"]):visible, [role="combobox"]:visible, [role="switch"]:visible, [role="radiogroup"]:visible, [role="radio"]:visible, fieldset[data-field-help-group]:visible'
  );
  const referencedIds = new Set<string>();
  const auditedConcepts = new Set<string>();

  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    if (await control.getAttribute('role') === 'radio') continue;
    const controlId = await control.getAttribute('id');
    expect(controlId, `controle visível #${index} sem id`).toBeTruthy();
    expect(await page.locator(`#${escapeId(controlId!)}`).count(), `id de controle duplicado: ${controlId}`).toBe(1);
    referencedIds.add(controlId!);

    const conceptId = await control.getAttribute('data-field-help-id') ?? controlId!;
    if (await control.getAttribute('data-field-help-group')) {
      expect(await control.getAttribute('data-field-help-group')).toBe(conceptId);
    }
    const helpId = `${conceptId}-help`;
    const triggerId = `${conceptId}-help-trigger`;
    const describedBy = (await control.getAttribute('aria-describedby'))?.split(/\s+/).filter(Boolean) ?? [];
    expect(describedBy, `${controlId} não aponta diretamente para ${helpId}`).toContain(helpId);
    expect(await page.locator(`#${escapeId(helpId)}`).count(), `help ausente ou duplicado: ${helpId}`).toBe(1);
    await expect(page.locator(`#${escapeId(helpId)}`)).toHaveAttribute('data-field-help-description', conceptId);
    await expect(page.locator(`#${escapeId(helpId)}`)).not.toHaveText(/^\s*$/);
    expect(await page.locator(`#${escapeId(triggerId)}`).count(), `trigger ausente ou duplicado: ${triggerId}`).toBe(1);
    await expect(page.locator(`#${escapeId(triggerId)}`)).toHaveAttribute('data-field-help-trigger', conceptId);
    referencedIds.add(helpId);
    referencedIds.add(triggerId);

    if (!auditedConcepts.has(conceptId)) {
      auditedConcepts.add(conceptId);
      const trigger = page.locator(`#${escapeId(triggerId)}`);
      await expect(trigger).toHaveAttribute('aria-label', /^Ajuda sobre .+/);
      await trigger.click();
      const controlsId = await trigger.getAttribute('aria-controls');
      const expectedPopupId = `${conceptId}-help-popup`;
      expect(controlsId, `${triggerId} sem aria-controls quando aberto`).toBe(expectedPopupId);
      const popup = page.locator(`#${escapeId(expectedPopupId)}`);
      await expect(popup, `popup global ausente ou ID duplicado: ${expectedPopupId}`).toHaveCount(1);
      await expect(popup).toHaveAttribute('data-field-help-popup', conceptId);
      await expect(popup).toBeVisible();
      await trigger.press('Escape');
      await expect(popup).toBeHidden();
      await expect(page.locator('[data-field-help-popup]:visible')).toHaveCount(0);
    }
  }

  const radios = page.locator('[role="radio"]:visible');
  for (let index = 0; index < await radios.count(); index += 1) {
    const radio = radios.nth(index);
    const radioId = await radio.getAttribute('id');
    expect(radioId, `radio #${index} sem id`).toBeTruthy();
    expect(await page.locator(`#${escapeId(radioId!)}`).count(), `id de radio duplicado: ${radioId}`).toBe(1);
    referencedIds.add(radioId!);
    const groups = radio.locator('xpath=ancestor::*[@role="radiogroup"]');
    expect(await groups.count(), `radio #${index} deve pertencer a exatamente um radiogroup`).toBe(1);
    const groupId = await groups.first().getAttribute('id');
    expect(groupId, `radiogroup do radio #${index} sem id`).toBeTruthy();
    const groupConcept = (await groups.first().getAttribute('data-field-help-id')) ?? groupId!;
    expect(auditedConcepts.has(groupConcept), `radiogroup ${groupConcept} não foi auditado como conceito`).toBe(true);
  }

  for (const id of referencedIds) {
    expect(await page.locator(`#${escapeId(id)}`).count(), `id referenciado duplicado: ${id}`).toBe(1);
  }

  const descriptions = await page.locator('[data-field-help-description]').evaluateAll((elements) =>
    elements.map((element) => ({ id: element.id, conceptId: element.getAttribute('data-field-help-description') ?? '' }))
  );
  const triggers = await page.locator('[data-field-help-trigger]').evaluateAll((elements) =>
    elements.map((element) => ({ id: element.id, conceptId: element.getAttribute('data-field-help-trigger') ?? '' }))
  );
  const helpConcepts = descriptions.map(({ conceptId }) => conceptId);
  const triggerConcepts = triggers.map(({ conceptId }) => conceptId);
  const count = (values: string[], value: string) => values.filter((item) => item === value).length;

  for (const conceptId of auditedConcepts) {
    expect(count(helpConcepts, conceptId), `conceito ${conceptId} deve ter exatamente um help`).toBe(1);
    expect(count(triggerConcepts, conceptId), `conceito ${conceptId} deve ter exatamente um trigger`).toBe(1);
  }
  for (const conceptId of helpConcepts) {
    const description = descriptions.find((item) => item.conceptId === conceptId)!;
    expect(description.id, `help ${conceptId} com id incorreto`).toBe(`${conceptId}-help`);
    expect(auditedConcepts.has(conceptId), `help órfão sem controle auditado: ${description.id}`).toBe(true);
    expect(count(helpConcepts, conceptId), `help duplicado: ${conceptId}-help`).toBe(1);
  }
  for (const conceptId of triggerConcepts) {
    const trigger = triggers.find((item) => item.conceptId === conceptId)!;
    expect(trigger.id, `trigger ${conceptId} com id incorreto`).toBe(`${conceptId}-help-trigger`);
    expect(auditedConcepts.has(conceptId), `trigger órfão sem controle auditado: ${trigger.id}`).toBe(true);
    expect(count(triggerConcepts, conceptId), `trigger duplicado: ${conceptId}-help-trigger`).toBe(1);
  }
  await expect(page.locator('[data-field-help-popup]:visible')).toHaveCount(0);
}

const ROUTES: Array<{ route: string; concepts: Concept[] }> = [
  {
    route: '/nova-simulacao',
    concepts: [
      { id: 'principal', label: 'Valor financiado (R$)' },
      { id: 'annualRate', label: 'Taxa de juros' },
      { id: 'months', label: 'Prazo (meses)' },
      { id: 'trMonthly', label: 'TR mensal (%)' },
      { id: 'insuranceMonthly', label: 'Seguro (R$/mês)' },
      { id: 'bank', label: 'Banco' },
      { id: 'system', label: 'Sistema' },
      { id: 'smartPrincipal', label: 'Valor financiado (R$)' },
      { id: 'smartRate', label: 'Taxa de juros' },
      { id: 'smartTr', label: 'TR mensal (%)' },
      { id: 'smartSeguro', label: 'Seguro (R$/mês)' },
      { id: 'smartBank', label: 'Banco' },
      { id: 'smartMaxMonths', label: 'Prazo máximo (meses)' },
      { id: 'smartMaxPayment2', label: 'Quanto pode pagar por mês (R$)' },
      { id: 'smartFixedUntil', label: 'Pagar esse valor por um período (opcional)' },
    ],
  },
  {
    route: '/qual-imovel-cabe-no-meu-bolso',
    concepts: [
      { id: 'affIncome', label: 'Renda mensal familiar (R$)' },
      { id: 'affCap', label: 'Parcela máxima (R$) · opcional' },
      { id: 'affCash', label: 'Dinheiro disponível (R$)' },
      { id: 'affCosts', label: 'Custos iniciais reservados (R$)' },
      { id: 'affMonths', label: 'Prazo (meses)' },
      { id: 'affRate', label: 'Taxa de juros' },
      { id: 'affTr', label: 'TR mensal (%)' },
      { id: 'affInsurance', label: 'Seguro (R$/mês)' },
      { id: 'affBank', label: 'Banco' },
    ],
  },
  {
    route: '/portabilidade',
    concepts: [
      { id: 'portPrincipal', label: 'Saldo devedor atual (R$)' },
      { id: 'portMonths', label: 'Parcelas restantes' },
      { id: 'portCurrentRate', label: 'Taxa atual' },
      { id: 'portTr', label: 'TR mensal (%)' },
      { id: 'portSeguro', label: 'Seguro atual (R$/mês)' },
      { id: 'portBank', label: 'Banco atual' },
      { id: 'portCurrentSystem', label: 'Sistema atual' },
      { id: 'portNewRate', label: 'Nova taxa' },
      { id: 'portNewSeguro', label: 'Novo seguro (R$/mês)' },
      { id: 'portNewBank', label: 'Novo banco' },
      { id: 'portNewSystem', label: 'Novo sistema' },
      { id: 'portCosts', label: 'Custos da portabilidade (R$)' },
      { id: 'portSmartMode', label: 'Busca inteligente', selector: '[role="switch"][aria-describedby="portSmartMode-help"]' },
    ],
  },
  {
    route: '/comparar-propostas',
    concepts: [
      { id: 'budget', label: 'Quanto consegue pagar por mês (R$)' },
      ...['p1', 'p2'].flatMap((id) => [
        { id: `${id}-bank`, label: 'Banco' },
        { id: `${id}-prop`, label: 'Imóvel (R$)' },
        { id: `${id}-entry`, label: 'Entrada (R$)' },
        { id: `${id}-principal`, label: 'Valor financiado (R$)' },
        { id: `${id}-system`, label: 'Sistema' },
        { id: `${id}-months`, label: 'Prazo (meses)' },
        { id: `${id}-rate`, label: 'Taxa contratual' },
        { id: `${id}-cet`, label: 'CET efetivo anual informado (%)' },
        { id: `${id}-tr`, label: 'TR mensal (%)' },
        { id: `${id}-insurance`, label: 'Seguro (R$/mês)' },
        { id: `${id}-fees`, label: 'Tarifas' },
      ]),
    ],
  },
];

test.beforeEach(async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarIlimitado(page);
});

for (const screen of ROUTES) {
  test(`${screen.route} expõe ajuda específica para lista requerida`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.goto(screen.route);

    for (const concept of screen.concepts) {
      await test.step(concept.id, async () => {
        const trigger = page.locator(`#${concept.id}-help-trigger`);
        const target = page.locator(concept.selector ?? `#${concept.id}`);
        await expect(trigger).toBeVisible();
        await expect(target).toBeVisible();
        await expect(target).toHaveAttribute('aria-describedby', new RegExp(`(^| )${concept.id}-help( |$)`));
        await expect(page.locator(`#${concept.id}-help`)).not.toHaveText('');
      });
    }
    await auditVisibleEditableControls(page);

    const representative = screen.concepts[0];
    await page.locator(`#${escapeId(representative.id)}-help-trigger`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(pageErrors).toEqual([]);
  });
}

test('auditoria rejeita descrição e trigger semânticos órfãos', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.evaluate(() => {
    const help = document.createElement('span');
    help.id = 'orphan-help';
    help.dataset.fieldHelpDescription = 'orphan';
    help.textContent = 'Ajuda órfã';
    const trigger = document.createElement('button');
    trigger.id = 'orphan-help-trigger';
    trigger.dataset.fieldHelpTrigger = 'orphan';
    trigger.setAttribute('aria-label', 'Ajuda sobre órfão');
    document.body.append(help, trigger);
  });

  await expect(auditVisibleEditableControls(page)).rejects.toThrow(/órfão|orphan/i);
});

test('auditoria rejeita container arbitrário que se registra como grupo', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.evaluate(() => {
    const fake = document.createElement('div');
    fake.id = 'fake-group';
    fake.dataset.fieldHelpGroup = 'fake-group';
    fake.dataset.fieldHelpId = 'principal';
    fake.setAttribute('aria-describedby', 'principal-help');
    fake.textContent = 'Grupo falso';
    document.body.append(fake);
  });

  await expect(auditVisibleEditableControls(page)).rejects.toThrow(/fake|grupo|controle/i);
});

test('controle legítimo com id terminado em -help não vira descrição', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.evaluate(() => {
    const control = document.createElement('input');
    control.id = 'normal-help';
    control.dataset.fieldHelpId = 'principal';
    control.setAttribute('aria-label', 'Controle legítimo');
    control.setAttribute('aria-describedby', 'principal-help');
    document.body.append(control);
  });

  await auditVisibleEditableControls(page);
});

test('auditoria rejeita controle comum com ID duplicado do popup antes de sua abertura', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.evaluate(() => {
    const control = document.createElement('input');
    control.id = 'principal-help-popup';
    control.dataset.fieldHelpId = 'principal';
    control.setAttribute('aria-label', 'Controle comum');
    control.setAttribute('aria-describedby', 'principal-help');
    document.body.append(control);
  });

  try {
    await expect(auditVisibleEditableControls(page)).rejects.toThrow(/popup global ausente ou ID duplicado: principal-help-popup/i);
  } finally {
    await page.locator('#principal-help-popup').first().evaluate((element) => element.remove());
  }
});

test('ajuda cobre tarifa dinâmica, amortização e switches retos', async ({ page }) => {
  await page.goto('/comparar-propostas');
  const feesGroup = page.getByRole('group', { name: 'Tarifas', exact: true }).first();
  await expect(feesGroup).toBeVisible();
  await expect(feesGroup).toHaveAccessibleName('Tarifas');
  await expect(feesGroup.locator(':scope > legend')).toHaveText('Tarifas');
  await expect(feesGroup.locator(':scope > div > [data-field-help-trigger="p1-fees"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Adicionar tarifa' }).first().click();
  await expect(page.getByLabel('Nome da tarifa').first()).toHaveAttribute('aria-describedby', 'p1-fees-help');
  await expect(page.getByLabel('Valor da tarifa').first()).toHaveAttribute('aria-describedby', /(^| )p1-fees-help( |$)/);
  await expect(page.getByLabel('Incluir tarifa no CET').first()).toHaveAttribute('aria-describedby', 'p1-fees-help');
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await page.getByRole('button', { name: 'Adicionar tarifa' }).nth(2).click();
  await expect(page.getByLabel('Nome da tarifa').nth(1)).toHaveAttribute('aria-describedby', 'p3-fees-help');
  await auditVisibleEditableControls(page);

  await page.goto('/nova-simulacao');
  await page.evaluate(() => sessionStorage.setItem('sim-input', JSON.stringify({
    system: 'PRICE',
    principal: '1000000',
    annualRate: '10.5',
    annualRateKind: 'effective-annual',
    months: '360',
    trMonthly: '0.17',
    insuranceMonthly: '100',
    bank: 'Caixa',
  })));
  await page.goto('/simulacao');
  const paySac = page.getByRole('switch', { name: 'Pagar como no SAC' });
  await expect(page.getByRole('button', { name: 'Ajuda sobre Pagar como no SAC' })).toBeVisible();
  await expect(paySac).toHaveAttribute('aria-describedby', 'paySacParcela-help');
  await page.getByRole('button', { name: 'Adicionar amortização' }).click();
  const type = page.getByRole('combobox', { name: 'Tipo de amortização' });
  for (const branch of ['Pontual', 'Mensal (total fixo)', '% extra mensal', 'Recorrente', 'Anual (FGTS)']) {
    await type.click();
    await page.getByRole('option', { name: branch, exact: true }).click();
    await auditVisibleEditableControls(page);
    if (branch === '% extra mensal') {
      const percent = page.getByRole('textbox', { name: 'Percentual (%)' });
      await percent.fill('14,17');
      await expect(percent).toHaveValue('14,17');
      await percent.blur();
      await percent.focus();
      await expect(percent).toHaveValue('14.17');
    }
    if (branch === 'Recorrente') {
      await expect(page.getByRole('textbox', { name: 'Intervalo (meses)' })).toHaveAttribute('aria-describedby', /-help/);
    }
  }
  await type.click();
  await page.getByRole('option', { name: 'Pontual', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mês do aporte' }).fill('12');
  await page.getByRole('textbox', { name: 'Valor (R$)' }).fill('30000000');
  const mode = page.getByRole('combobox', { name: 'Modo' });
  await expect(mode).toBeVisible();
  await expect(mode).toHaveAttribute('aria-describedby', /-help/);
  await auditVisibleEditableControls(page);

  // SAC também existe como estratégia de linha e como switch global para PRICE.
  await type.click();
  await page.getByRole('option', { name: 'Pagar como no SAC', exact: true }).click();
  await auditVisibleEditableControls(page);
  await expect(paySac).toBeChecked();
  await paySac.click();
  await expect(paySac).not.toBeChecked();

  const switchControl = page.getByRole('switch').first();
  await expect(switchControl).toHaveCSS('border-radius', '0px');
  await expect(switchControl.locator('[data-slot="switch-thumb"]')).toHaveCSS('border-radius', '0px');

  await page.goto('/portabilidade');
  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  await expect(page.getByRole('button', { name: 'Ajuda sobre Parcela desejada (R$, opcional)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' })).toHaveAttribute('aria-describedby', /(^| )portTarget-help( |$)/);
  await auditVisibleEditableControls(page);
});

test('modo por parcela mantém contrato de ajuda nos controles compartilhados e opcionais', async ({ page }) => {
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await expect(page.getByRole('textbox', { name: /renda mensal/i })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Parcela máxima (R$)', exact: true })).toHaveAttribute('aria-describedby', /(^| )affCap-help( |$)/);
  await expect(page.getByRole('textbox', { name: /entrada disponível/i })).toHaveAttribute('aria-describedby', /(^| )affCash-help( |$)/);
  await expect(page.getByRole('textbox', { name: /custos iniciais/i })).toHaveAttribute('aria-describedby', /(^| )affCosts-help( |$)/);
  await auditVisibleEditableControls(page);
});
