import { runLocalPlaywrightE2E } from './run-local-playwright-e2e.mjs'

function main() {
  runLocalPlaywrightE2E({
    label: 'deck builder',
    specPath: 'tests/e2e/decks/deck-builder.spec.ts',
  })
}

try {
  main()
} catch (error) {
  console.error('Deck builder e2e checkpoint failed.')
  console.error(error)
  process.exitCode = 1
}
