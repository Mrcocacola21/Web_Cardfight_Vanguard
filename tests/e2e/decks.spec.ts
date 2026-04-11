import { expect, test } from '@playwright/test'

import { registerAndReachProfile } from './auth-helpers'

function createUniqueEmail() {
  return `deck-builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

test.skip(
  true,
  'Blocked by the current auth/profile runtime gap: the authenticated browser flow still reaches the protected shell before profile-owned reads stabilize.',
)

test('deck builder create -> add -> autosave flow works against the local runtime', async ({
  page,
}) => {
  const email = createUniqueEmail()
  const password = 'VanguardPass123!'

  await registerAndReachProfile(page, {
    displayName: 'Deck Builder Pilot',
    email,
    password,
  })

  await page.goto('/decks', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', {
      name: /my decks/i,
    }),
  ).toBeVisible()
  await expect(page.getByText(/no decks yet/i)).toBeVisible()

  await Promise.all([
    page.waitForURL(/\/decks\/create$/),
    page.getByRole('link', { name: /create your first deck/i }).click(),
  ])

  await expect(
    page.getByRole('heading', {
      name: /choose a format/i,
    }),
  ).toBeVisible()

  await page.getByLabel(/format/i).selectOption('standard')

  await Promise.all([
    page.waitForURL(/\/decks\/[^/?#]+$/),
    page.getByRole('button', { name: /^create deck$/i }).click(),
  ])

  await expect(
    page.getByRole('heading', {
      name: /untitled deck/i,
    }),
  ).toBeVisible()
  await expect(page.getByText(/deck is empty/i)).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /add apex ruler, bastion/i,
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: /add apex ruler, bastion/i }).click()

  await expect(
    page.getByRole('button', {
      name: /increase apex ruler, bastion/i,
    }),
  ).toBeVisible()
  await expect(page.getByText(/^unsaved changes$/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible()

  await page.getByLabel(/^name$/i).fill('E2E Bastion Deck')
  await expect(page.getByText(/^unsaved changes$/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByLabel(/^name$/i)).toHaveValue('E2E Bastion Deck')
  await expect(
    page.getByRole('button', {
      name: /increase apex ruler, bastion/i,
    }),
  ).toBeVisible()
})
