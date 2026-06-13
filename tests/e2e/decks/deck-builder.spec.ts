import { expect, test } from '@playwright/test'

import { createE2EUser, registerAndReachProfile } from '../support/auth'
import { createDeckThroughUi } from '../support/decks'
import { createUniqueTestId, useLocalSupabase } from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('deck builder create, edit, validate, autosave, reload, and remove-card flow works', async ({
  page,
}) => {
  const user = createE2EUser('deck-builder')
  const deckTitle = `E2E Azure Deck ${createUniqueTestId('draft')}`

  await registerAndReachProfile(page, user)

  await page.goto('/decks', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/no decks yet/i)).toBeVisible()

  await createDeckThroughUi(page, {
    title: deckTitle,
    formatId: 'standard',
  })

  await expect(page.getByRole('heading', { name: deckTitle })).toBeVisible()
  await expect(page.getByText(/deck is empty/i)).toBeVisible()
  await expect(page.getByText(/needs fixes/i)).toBeVisible()

  await page.getByRole('button', { name: /add azure vanguard dragon/i }).click()

  await expect(
    page.getByRole('button', { name: /increase azure vanguard dragon/i }),
  ).toBeVisible()
  await expect(page.getByText(/^unsaved changes$/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible({
    timeout: 15_000,
  })

  await page
    .getByLabel(/description/i)
    .fill('E2E deck builder persistence note')
  await page.getByLabel(/mark deck as favorite/i).check()
  await page.getByLabel(/tags/i).fill('regression')
  await page.getByRole('button', { name: /add tag/i }).click()

  await expect(page.getByText(/^unsaved changes$/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/^favorite$/i).first()).toBeVisible()
  await expect(page.getByText('regression')).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByLabel(/^name$/i)).toHaveValue(deckTitle)
  await expect(page.getByLabel(/description/i)).toHaveValue(
    'E2E deck builder persistence note',
  )
  await expect(page.getByLabel(/mark deck as favorite/i)).toBeChecked()
  await expect(page.getByText('regression')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /remove azure vanguard dragon/i }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: /remove azure vanguard dragon/i })
    .click()

  await expect(page.getByText(/deck is empty/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible({
    timeout: 15_000,
  })
})

test('deck list filtering, duplication, and deletion work from the protected list page', async ({
  page,
}) => {
  const user = createE2EUser('deck-list')
  const deckTitle = `E2E List Deck ${createUniqueTestId('deck')}`

  await registerAndReachProfile(page, user)
  await createDeckThroughUi(page, {
    title: deckTitle,
    formatId: 'standard',
  })

  await page.goto('/decks', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(deckTitle)).toBeVisible()

  await page.getByLabel(/format/i).selectOption('v-premium')
  await page.getByRole('button', { name: /apply filters/i }).click()
  await expect(page).toHaveURL(/format=v-premium/)
  await expect(page.getByText(/no decks match this filter/i)).toBeVisible()

  await page.getByRole('link', { name: /show all decks/i }).click()
  await expect(page.getByText(deckTitle)).toBeVisible()

  await page
    .getByRole('button', { name: new RegExp(`duplicate ${deckTitle}`, 'i') })
    .click()

  await expect(page.getByText(`${deckTitle} (copy)`)).toBeVisible({
    timeout: 10_000,
  })

  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', {
      name: new RegExp(`delete ${deckTitle} \\(copy\\)`, 'i'),
    })
    .click()

  await expect(page.getByText(`${deckTitle} (copy)`)).toHaveCount(0)
  await expect(page.getByText(deckTitle)).toBeVisible()
})
