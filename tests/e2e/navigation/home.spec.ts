import { expect, test } from '@playwright/test'

test('homepage renders the public foundation shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText(/cardfight!! vanguard web client/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /open catalog/i })).toBeVisible()
})
