import { expect, test } from '@playwright/test'

import { registerAndReachProfile } from './auth-helpers'

function createUniqueEmail() {
  return `auth-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

test('guest users are redirected away from protected routes', async ({
  page,
}) => {
  await page.goto('/profile', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', {
      name: /sign in/i,
    }),
  ).toBeVisible()
})

test('registration, login, logout, and auth-page redirects work end-to-end with local Supabase', async ({
  page,
}) => {
  const email = createUniqueEmail()
  const password = 'VanguardPass123!'

  await registerAndReachProfile(page, {
    displayName: 'Azure Pilot',
    email,
    password,
  })

  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()
  await expect(page.getByText(new RegExp(email, 'i'))).toBeVisible()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/profile$/)

  await Promise.all([
    page.waitForURL(/\/login$/),
    page.getByRole('button', { name: /sign out/i }).click(),
  ])

  await page.goto('/profile', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)

  await Promise.all([
    page.waitForURL(/\/profile$/),
    page.getByRole('button', { name: /sign in/i }).click(),
  ])

  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()

  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/profile$/)
})
