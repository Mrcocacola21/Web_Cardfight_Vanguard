import { expect, type Page } from '@playwright/test'

export interface CreatedDeck {
  readonly deckId: string
  readonly title: string
}

export async function createDeckThroughUi(
  page: Page,
  input: {
    readonly title: string
    readonly formatId?: 'standard' | 'v-premium' | 'premium'
  },
): Promise<CreatedDeck> {
  await page.goto('/decks', { waitUntil: 'domcontentloaded' })

  await Promise.all([
    page.waitForURL(/\/decks\/create$/),
    page.getByRole('link', { name: /^create deck$/i }).click(),
  ])

  await page.getByLabel(/format/i).selectOption(input.formatId ?? 'standard')

  await Promise.all([
    page.waitForURL(/\/decks\/[^/?#]+$/),
    page.getByRole('button', { name: /^create deck$/i }).click(),
  ])

  const deckUrl = new URL(page.url())
  const deckId = decodeURIComponent(deckUrl.pathname.split('/').at(-1) ?? '')

  if (!deckId) {
    throw new Error(`Could not resolve deck id from URL ${page.url()}.`)
  }

  await expect(
    page.getByRole('heading', { name: /untitled deck/i }),
  ).toBeVisible()
  await page.getByLabel(/^name$/i).fill(input.title)
  await expect(page.getByText(/^unsaved changes$/i)).toBeVisible()
  await expect(page.getByText(/^saved$/i)).toBeVisible({
    timeout: 15_000,
  })

  return {
    deckId,
    title: input.title,
  }
}
