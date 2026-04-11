import { expect, type Page } from '@playwright/test'

interface RegisterAndReachProfileInput {
  readonly displayName: string
  readonly email: string
  readonly password: string
}

export async function registerAndReachProfile(
  page: Page,
  input: RegisterAndReachProfileInput,
) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/display name/i).fill(input.displayName)
  await page.getByLabel(/email/i).fill(input.email)
  await page.getByLabel(/^password$/i).fill(input.password)
  await page.getByLabel(/confirm password/i).fill(input.password)
  await page.getByRole('button', { name: /create account/i }).click()

  const reachedProfile = await waitForProfileAfterRegistration(page)

  if (!reachedProfile) {
    await expect(page.getByText(/account created/i)).toBeVisible()

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(input.email)
    await page.getByLabel(/^password$/i).fill(input.password)

    await Promise.all([
      page.waitForURL(/\/profile$/),
      page.getByRole('button', { name: /sign in/i }).click(),
    ])
  }

  await expect(
    page.getByRole('heading', {
      name: /my profile/i,
    }),
  ).toBeVisible()

  await ensureProfileRow(page, input.displayName)
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

  await expect(page.getByText(/profile saved/i)).toBeVisible()
}
