import { expect, test } from '@playwright/test'

import { createE2EUser, registerAndReachProfile } from '../support/auth'
import { useLocalSupabase } from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('printing detail collection actions update owned collection, wishlist, and favorites', async ({
  page,
}) => {
  const user = createE2EUser('collection')

  await registerAndReachProfile(page, user)

  await page.goto(
    '/catalog/printings/printing.azure-vanguard-dragon.d-sd01.004.en',
    { waitUntil: 'domcontentloaded' },
  )

  await expect(page.getByText(/owned copies/i)).toBeVisible()
  await page.getByRole('button', { name: /add to collection/i }).click()
  await expect(page.getByRole('button', { name: /add one/i })).toBeVisible()

  await page.getByRole('button', { name: /add to wishlist/i }).click()
  await expect(
    page.getByRole('button', { name: /remove from wishlist/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: /add to favorites/i }).click()
  await expect(
    page.getByRole('button', { name: /remove from favorites/i }),
  ).toBeVisible()

  await page.goto('/collection', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', { name: /my collection/i }),
  ).toBeVisible()
  await expect(page.getByText(/1 owned printings/i)).toBeVisible()
  await expect(page.getByText(/1 total copies/i)).toBeVisible()
  await expect(page.getByText(/Azure Vanguard Dragon/).first()).toBeVisible()
  await expect(page.getByText(/Wishlist printings/i)).toBeVisible()
  await expect(page.getByText(/Favorite printings/i)).toBeVisible()

  await page.getByRole('link', { name: /^list view$/i }).click()
  await expect(page).toHaveURL(/view=list/)
  await expect(page.getByRole('columnheader', { name: /card/i })).toBeVisible()

  await page.getByLabel(/sort/i).selectOption('quantity')
  await page.getByRole('button', { name: /^apply$/i }).click()
  await expect(page).toHaveURL(/sort=quantity/)

  await page
    .getByRole('button', { name: /remove this printing from collection/i })
    .click()

  await expect(page.getByText(/your collection is empty/i)).toBeVisible()
  await expect(page.getByText(/Favorite printings/i)).toBeVisible()
})
