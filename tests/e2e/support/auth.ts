import { expect, type Page } from '@playwright/test'

import {
  createUniqueEmail,
  createUniqueTestId,
  defaultE2EPassword,
} from './env'

export interface E2EUser {
  readonly displayName: string
  readonly email: string
  readonly password: string
}

export function createE2EUser(prefix: string): E2EUser {
  const id = createUniqueTestId(prefix)

  return {
    displayName: `E2E ${id}`,
    email: createUniqueEmail(prefix),
    password: defaultE2EPassword,
  }
}

export async function registerAndReachProfile(page: Page, input: E2EUser) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/display name/i).fill(input.displayName)
  await page.getByLabel(/email/i).fill(input.email)
  await page.getByLabel(/^password$/i).fill(input.password)
  await page.getByLabel(/confirm password/i).fill(input.password)
  await page.getByRole('button', { name: /create account/i }).click()

  const reachedProfile = await waitForProfileAfterRegistration(page)

  if (!reachedProfile) {
    await expect(page.getByText(/account created/i)).toBeVisible()
    await signIn(page, input)
  }

  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()

  await ensureProfileRow(page, input.displayName)
}

export async function signIn(page: Page, input: E2EUser) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(input.email)
  await page.getByLabel(/^password$/i).fill(input.password)

  await Promise.all([
    page.waitForURL(/\/profile$/),
    page.getByRole('button', { name: /sign in/i }).click(),
  ])
}

export async function signOut(page: Page) {
  await Promise.all([
    page.waitForURL(/\/login$/),
    page.getByRole('button', { name: /sign out/i }).click(),
  ])
}

export async function makeProfilePublic(page: Page, input: E2EUser) {
  await page.goto('/profile', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/^display name$/i).fill(input.displayName)
  await page.getByLabel(/profile visibility/i).selectOption('public')
  await page.getByLabel(/^bio$/i).fill(`${input.displayName} public bio`)
  await page.getByLabel(/bio visibility/i).selectOption('public')
  await page.getByRole('button', { name: /save profile/i }).click()

  await expectProfileSaved(page)
}

async function waitForProfileAfterRegistration(page: Page): Promise<boolean> {
  try {
    await page.waitForURL(/\/profile$/, {
      timeout: 5_000,
    })
    return true
  } catch {
    return false
  }
}

async function ensureProfileRow(page: Page, displayName: string) {
  const emptyProfileState = page.getByText(/no profile row yet/i)

  if (!(await emptyProfileState.isVisible().catch(() => false))) {
    return
  }

  await page.getByLabel(/^display name$/i).fill(displayName)
  await page.getByRole('button', { name: /save profile/i }).click()

  await expectProfileSaved(page)
}

async function expectProfileSaved(page: Page) {
  await expect(page.getByText('Profile saved', { exact: true })).toBeVisible()
}
