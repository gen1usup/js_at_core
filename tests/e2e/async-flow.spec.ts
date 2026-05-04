import { expect, test } from '@playwright/test';

test.describe('Demo Web App browser async flow', () => {
  test('refreshes the task list until a queued task is completed by the worker', async ({
    page
  }) => {
    const unique = `${Date.now().toString(16)}-${test.info().workerIndex}`;
    const username = `pw-async-user-${unique}`;
    const password = 'P@ssw0rd123';
    const taskTitle = `Playwright async task ${unique}`;
    const output = page.locator('#output');

    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('demo_token'));

    await page.getByPlaceholder('username').fill(username);
    await page.getByPlaceholder('password').fill(password);
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(output).toContainText(username);

    await page.getByRole('button', { name: 'Login' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('demo_token'))).toBeTruthy();

    await page.getByPlaceholder('task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(output).toContainText(taskTitle);
    await expect(output).toContainText('queued');

    await expect
      .poll(
        async () => {
          await page.getByRole('button', { name: 'Refresh Tasks' }).click();
          return output.textContent();
        },
        {
          timeout: 10_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatch(/completed/);

    await expect(output).toContainText(taskTitle);
  });
});
