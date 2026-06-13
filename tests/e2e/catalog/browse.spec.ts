import { expect, test } from '@playwright/test'

import { useLocalSupabase } from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('catalog search, filters, and card/product/printing detail navigation work', async ({
  page,
}) => {
  await page.goto('/catalog', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', { name: /card catalog/i }),
  ).toBeVisible()
  await expect(page.getByText(/10 total matches/i)).toBeVisible()

  const searchBox = page.getByRole('searchbox', { name: /search cards/i })

  await page.getByLabel(/format/i).selectOption('standard')
  await searchBox.fill('Azure Vanguard Dragon')
  await page.getByLabel(/nation/i).selectOption('dragon empire')
  await page.getByRole('button', { name: /^apply$/i }).click()

  await expect(page).toHaveURL(/\/catalog\?/)
  await expect(searchBox).toHaveValue('Azure Vanguard Dragon')
  await expect(page.getByLabel(/format/i)).toHaveValue('standard')
  await expect(page.getByLabel(/nation/i)).toHaveValue('dragon empire')
  await expect(page.getByText(/Azure Vanguard Dragon/).first()).toBeVisible()

  await page
    .getByRole('link', { name: /view card/i })
    .first()
    .click()

  await expect(page).toHaveURL(/\/catalog\/card\.azure-vanguard-dragon$/)
  await expect(
    page.getByRole('heading', { name: /^Azure Vanguard Dragon$/i }),
  ).toBeVisible()
  await expect(page.getByText(/restriction lists/i)).toBeVisible()

  await page
    .getByRole('link', { name: /printing detail/i })
    .first()
    .click()

  await expect(page).toHaveURL(/\/catalog\/printings\//)
  await expect(page.getByText(/printing facts/i)).toBeVisible()
  await expect(page.getByText(/your collection/i)).toBeVisible()

  await page
    .getByRole('link', { name: /release page/i })
    .first()
    .click()

  await expect(page).toHaveURL(/\/catalog\/products\//)
  await expect(page.getByText(/release info/i)).toBeVisible()
  await expect(page.getByText('Printing list', { exact: true })).toBeVisible()

  await page.goBack()
  await page.goBack()
  await page.goBack()

  await expect(searchBox).toHaveValue('Azure Vanguard Dragon')
  await expect(page.getByLabel(/format/i)).toHaveValue('standard')
})

test('catalog no-results state can be cleared back to the full list', async ({
  page,
}) => {
  await page.goto('/catalog?q=no-such-card-e2e', {
    waitUntil: 'domcontentloaded',
  })

  await expect(page.getByText(/no cards match this query/i)).toBeVisible()

  await page.getByRole('link', { name: /clear filters/i }).click()

  await expect(page).toHaveURL(/\/catalog$/)
  await expect(page.getByText(/10 total matches/i)).toBeVisible()
})
