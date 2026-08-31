import { expect, test, type Page } from '@playwright/test';

async function cadastrar(page: Page) {
  const email = `money-input${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('MoneyInput não reaproveita zeros da máscara', async ({ baseURL, context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  await cadastrar(page);

  const input = page.getByRole('textbox', { name: /valor financiado/i });
  await input.focus();
  await page.keyboard.insertText('12345678');
  await expect(input).toHaveValue('123.456,78');
  await input.blur();
  await expect(input).toHaveValue(/^R\$\s123\.456,78$/);
  await input.focus();
  await expect(input).toHaveValue('123.456,78');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('0,00');
  await page.keyboard.insertText('100');
  await expect(input).toHaveValue('1,00');
  await input.blur();
  await expect(input).toHaveValue(/^R\$\s1,00$/);

  await input.focus();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('0,00');
  await page.evaluate(() => navigator.clipboard.writeText('1234'));
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
  await expect(input).toHaveValue('12,34');

  await input.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    setValue?.call(input, '１２３');
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: '１２３',
      inputType: 'insertCompositionText',
      isComposing: true,
    }));
  });
  await expect(input).toHaveValue('１２３');
  await input.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, '5678');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '5678' }));
  });
  await expect(input).toHaveValue('56,78');
});

test('MoneyInput rejeita teclado e paste acima de 13 dígitos sem truncar valor válido', async ({ baseURL, context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  await cadastrar(page);
  const input = page.getByRole('textbox', { name: /valor financiado/i });

  await input.fill('1234567890123');
  await expect(input).toHaveValue('12.345.678.901,23');
  await page.keyboard.insertText('4');
  await expect(input).toHaveValue('12.345.678.901,23');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/limite de 13 dígitos/i)).toBeAttached();
  await expect(input).toHaveAttribute('aria-describedby', /principal-help/);

  await page.evaluate(() => navigator.clipboard.writeText('99999999999999'));
  await input.selectText();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
  await expect(input).toHaveValue('12.345.678.901,23');
  await input.blur();
  await expect(input).toHaveValue(/^R\$\s12\.345\.678\.901,23$/);
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await input.focus();
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', /principal-help/);
  await page.keyboard.press('Backspace');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
});
