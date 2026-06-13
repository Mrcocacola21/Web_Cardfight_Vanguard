import { expect, test } from '@playwright/test'

import {
  createE2EUser,
  makeProfilePublic,
  registerAndReachProfile,
} from '../support/auth'
import { createDeckThroughUi } from '../support/decks'
import {
  createPersistedE2EMatchRoom,
  getProfileByDisplayName,
} from '../support/db'
import {
  createUniqueTestId,
  useLocalSupabase,
  useLocalSupabaseServiceRole,
} from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('manual match entry creates history records and updates stats routes', async ({
  browser,
}) => {
  const owner = createE2EUser('match-owner')
  const opponent = createE2EUser('match-opponent')
  const ownerContext = await browser.newContext()
  const opponentContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const opponentPage = await opponentContext.newPage()
  const deckTitle = `E2E Match Deck ${createUniqueTestId('deck')}`
  const notes = `E2E match notes ${createUniqueTestId('notes')}`

  try {
    await registerAndReachProfile(opponentPage, opponent)
    await makeProfilePublic(opponentPage, opponent)

    await registerAndReachProfile(ownerPage, owner)
    await createDeckThroughUi(ownerPage, {
      title: deckTitle,
      formatId: 'standard',
    })

    await ownerPage.goto('/matches/new', { waitUntil: 'domcontentloaded' })
    await expect(
      ownerPage.getByRole('heading', { name: /record match/i }),
    ).toBeVisible()

    await ownerPage
      .getByLabel(/search opponent profiles/i)
      .fill(opponent.displayName)
    await ownerPage.getByRole('button', { name: /^search$/i }).click()
    await expect(
      ownerPage.getByText(opponent.displayName, { exact: true }).first(),
    ).toBeVisible()
    await ownerPage.getByRole('button', { name: /^select$/i }).click()
    await expect(
      ownerPage
        .getByText(`${opponent.displayName} public bio`, { exact: true })
        .first(),
    ).toBeVisible()

    await ownerPage.getByLabel(/^deck$/i).selectOption({ index: 1 })
    await ownerPage.getByLabel(/^result$/i).selectOption('win')
    await ownerPage.getByLabel(/^notes$/i).fill(notes)
    await ownerPage.getByRole('button', { name: /save match/i }).click()

    await expect(
      ownerPage.getByRole('status').filter({ hasText: /match recorded/i }),
    ).toBeVisible()

    await ownerPage.goto('/matches', { waitUntil: 'domcontentloaded' })
    await expect(
      ownerPage.getByText(opponent.displayName, { exact: true }).first(),
    ).toBeVisible()
    await expect(ownerPage.getByText(notes)).toBeVisible()
    await expect(ownerPage.getByText(/^Win$/i)).toBeVisible()

    await ownerPage.goto('/matches?result=loss', {
      waitUntil: 'domcontentloaded',
    })
    await expect(ownerPage).toHaveURL(/result=loss/)
    await expect(
      ownerPage.getByText(/no matches match these filters/i),
    ).toBeVisible()

    await ownerPage.goto('/matches/stats', { waitUntil: 'domcontentloaded' })
    await expect(ownerPage.getByText(/1 tracked matches/i)).toBeVisible()
    await expect(ownerPage.getByText(/100\.0%/i)).toBeVisible()

    await ownerPage.goto('/matches/friends', { waitUntil: 'domcontentloaded' })
    await expect(ownerPage.getByText(/no active friends yet/i)).toBeVisible()
  } finally {
    await ownerContext.close()
    await opponentContext.close()
  }
})

test('local match prototype renders match UI and accepts a visible room action', async ({
  page,
}) => {
  const user = createE2EUser('local-match')

  await registerAndReachProfile(page, user)
  await page.goto('/matches/play/local', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: /match room/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /match board/i })).toBeVisible()
  await expect(
    page.getByRole('region', { name: /available actions/i }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: /event log/i })).toBeVisible()

  await page.getByRole('button', { name: /ready aichi/i }).click()

  await expect(page.getByText(/^Accepted$/i)).toBeVisible()
  await expect(page.getByText(/Seat 0 \| Ready/i)).toBeVisible()
  await expect(page.getByText(/transition:action:/i)).toBeVisible()

  await page.getByRole('button', { name: /reset local room/i }).click()
  await expect(page.getByText(/no command submitted yet/i)).toBeVisible()
})

test('persisted projected match room enforces access and syncs an authoritative update across two browsers', async ({
  browser,
}) => {
  test.skip(
    !useLocalSupabaseServiceRole,
    'Requires local Supabase service role for persisted match room storage.',
  )

  const alpha = createE2EUser('room-alpha')
  const beta = createE2EUser('room-beta')
  const outsider = createE2EUser('room-outsider')
  const alphaContext = await browser.newContext()
  const betaContext = await browser.newContext()
  const outsiderContext = await browser.newContext()
  const alphaPage = await alphaContext.newPage()
  const betaPage = await betaContext.newPage()
  const outsiderPage = await outsiderContext.newPage()

  try {
    await registerAndReachProfile(alphaPage, alpha)
    await registerAndReachProfile(betaPage, beta)
    await registerAndReachProfile(outsiderPage, outsider)

    const roomId = await createPersistedE2EMatchRoom({
      firstProfile: await getProfileByDisplayName(alpha.displayName),
      secondProfile: await getProfileByDisplayName(beta.displayName),
    })
    const roomPath = `/matches/play/${roomId}`

    await outsiderPage.goto(roomPath, { waitUntil: 'domcontentloaded' })
    await expect(
      outsiderPage.getByText(/match room access denied/i),
    ).toBeVisible()

    await alphaPage.goto(roomPath, { waitUntil: 'domcontentloaded' })
    await betaPage.goto(roomPath, { waitUntil: 'domcontentloaded' })

    await expect(
      alphaPage.getByRole('heading', { name: /match room/i }),
    ).toBeVisible()
    await expect(
      betaPage.getByRole('heading', { name: /match room/i }),
    ).toBeVisible()

    await alphaPage
      .getByRole('button', {
        name: new RegExp(`ready ${alpha.displayName}`, 'i'),
      })
      .click()

    await expect(alphaPage.getByText(/^Accepted$/i)).toBeVisible()
    await expect(betaPage.getByText(/Seat 0 \| Ready/i)).toBeVisible({
      timeout: 12_000,
    })
    await expect(betaPage.getByText(/Room r2/i).first()).toBeVisible({
      timeout: 12_000,
    })
  } finally {
    await alphaContext.close()
    await betaContext.close()
    await outsiderContext.close()
  }
})
