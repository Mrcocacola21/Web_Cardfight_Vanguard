import { expect, test } from '@playwright/test'

import {
  createE2EUser,
  registerAndReachProfile,
  signIn,
  signOut,
} from '../support/auth'
import { useLocalSupabase } from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('guest users are redirected away from protected routes', async ({
  page,
}) => {
  for (const protectedRoute of [
    '/profile',
    '/decks',
    '/collection',
    '/friends',
    '/matches',
    '/matches/play/local',
  ]) {
    await page.goto(protectedRoute, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('heading', {
        name: /sign in/i,
      }),
    ).toBeVisible()
  }
})

test('registration, login, logout, and auth-page redirects work end-to-end', async ({
  page,
}) => {
  const user = createE2EUser('auth-routing')

  await registerAndReachProfile(page, user)

  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()
  await expect(
    page.getByText(user.email, { exact: true }).first(),
  ).toBeVisible()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/profile$/)

  await signOut(page)

  await page.goto('/profile', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, user)
  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()

  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/profile$/)
})

test('authenticated users can navigate protected app surfaces from the shell', async ({
  page,
}) => {
  const user = createE2EUser('auth-nav')

  await registerAndReachProfile(page, user)

  const primaryNav = page.getByRole('navigation', { name: /primary/i }).first()

  await primaryNav.getByRole('link', { name: /collection/i }).click()
  await expect(page).toHaveURL(/\/collection$/)
  await expect(
    page.getByRole('heading', { name: /my collection/i }),
  ).toBeVisible()

  await primaryNav.getByRole('link', { name: /decks/i }).click()
  await expect(page).toHaveURL(/\/decks$/)
  await expect(page.getByRole('heading', { name: /my decks/i })).toBeVisible()

  await primaryNav.getByRole('link', { name: /friends/i }).click()
  await expect(page).toHaveURL(/\/friends$/)
  await expect(page.getByRole('heading', { name: /^friends$/i })).toBeVisible()

  await primaryNav.getByRole('link', { name: /matches/i }).click()
  await expect(page).toHaveURL(/\/matches$/)
  await expect(
    page.getByRole('heading', { name: /match history/i }),
  ).toBeVisible()
})
