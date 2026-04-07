import { expect, test } from '@playwright/test'

test('homepage renders the foundation shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText(/cardfight!! vanguard web client/i)).toBeVisible()
})
