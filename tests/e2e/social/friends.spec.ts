import { expect, test } from '@playwright/test'

import {
  createE2EUser,
  makeProfilePublic,
  registerAndReachProfile,
} from '../support/auth'
import { useLocalSupabase } from '../support/env'

test.skip(
  !useLocalSupabase,
  'Requires the dedicated local Supabase Playwright runtime.',
)

test('two users can send, receive live dashboard updates for, accept, and remove friendship', async ({
  browser,
}) => {
  const alice = createE2EUser('social-alice')
  const bob = createE2EUser('social-bob')
  const aliceContext = await browser.newContext()
  const bobContext = await browser.newContext()
  const alicePage = await aliceContext.newPage()
  const bobPage = await bobContext.newPage()

  try {
    await registerAndReachProfile(alicePage, alice)
    await makeProfilePublic(alicePage, alice)

    await registerAndReachProfile(bobPage, bob)
    await makeProfilePublic(bobPage, bob)

    await alicePage.goto('/users', { waitUntil: 'domcontentloaded' })
    await alicePage
      .getByRole('searchbox', { name: /^search users$/i })
      .first()
      .fill(bob.displayName)
    await alicePage.getByRole('button', { name: /^search$/i }).click()
    await expect(
      alicePage.getByText(bob.displayName, { exact: true }).first(),
    ).toBeVisible()

    await alicePage.getByRole('link', { name: /view profile/i }).click()
    await expect(
      alicePage.getByRole('heading', { name: bob.displayName }),
    ).toBeVisible()
    const bobProfilePath = new URL(alicePage.url()).pathname
    const friendRequestResponse = alicePage
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === bobProfilePath,
        { timeout: 15_000 },
      )
      .catch(() => null)
    await alicePage.getByRole('button', { name: /add friend/i }).click()
    await friendRequestResponse

    await alicePage.goto('/friends', { waitUntil: 'domcontentloaded' })
    await expect(
      alicePage.getByText('Outgoing requests', { exact: true }),
    ).toBeVisible()
    await expect(
      alicePage.getByText(bob.displayName, { exact: true }).first(),
    ).toBeVisible()

    await bobPage.goto('/friends', { waitUntil: 'domcontentloaded' })
    await expect(
      bobPage.getByText('Incoming friend requests', { exact: true }),
    ).toBeVisible()
    await expect(
      bobPage.getByText(alice.displayName, { exact: true }).first(),
    ).toBeVisible()
    const acceptResponse = bobPage
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/friends',
        { timeout: 15_000 },
      )
      .catch(() => null)
    await bobPage.getByRole('button', { name: /^accept$/i }).click()
    await acceptResponse
    await bobPage.goto('/friends', { waitUntil: 'domcontentloaded' })
    await expect(
      bobPage.getByText(alice.displayName, { exact: true }).first(),
    ).toBeVisible()
    await expect(bobPage.getByText(/1 friends/i).first()).toBeVisible()

    await expect(
      alicePage.getByText(bob.displayName, { exact: true }).first(),
    ).toBeVisible({ timeout: 12_000 })
    await expect(alicePage.getByText(/1 friends/i).first()).toBeVisible({
      timeout: 12_000,
    })

    await alicePage.getByRole('button', { name: /remove friend/i }).click()
    const removalResponse = alicePage
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/friends',
        { timeout: 15_000 },
      )
      .catch(() => null)
    await alicePage.getByRole('button', { name: /confirm removal/i }).click()
    await removalResponse
    await alicePage.goto('/friends', { waitUntil: 'domcontentloaded' })
    await expect(alicePage.getByText(/no friends yet/i)).toBeVisible()
  } finally {
    await aliceContext.close()
    await bobContext.close()
  }
})
