import { expect, test } from '@playwright/test';

test.describe('Demo Web App browser smoke', () => {
  test('registers, logs in and creates a task through the UI', async ({ page }) => {
    const unique = Date.now().toString(16);
    const username = `pw-user-${unique}`;
    const password = 'P@ssw0rd123';
    const taskTitle = `Playwright demo task ${unique}`;

    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('demo_token'));

    await expect(page).toHaveTitle('Demo Web App');
    await expect(page.getByRole('heading', { name: 'Demo Web App' })).toBeVisible();

    await page.getByPlaceholder('username').fill(username);
    await page.getByPlaceholder('password').fill(password);
    await page.getByRole('button', { name: 'Register' }).click();

    const output = page.locator('#output');
    await expect(output).toContainText(username);

    await page.getByRole('button', { name: 'Login' }).click();
    await expect(output).toContainText('token');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('demo_token'))).toBeTruthy();

    await page.getByPlaceholder('task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect(output).toContainText(taskTitle);
    await expect(output).toContainText('queued');
  });
});
