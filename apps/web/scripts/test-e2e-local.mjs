import { runLocalPlaywrightE2E } from './run-local-playwright-e2e.mjs'

function main() {
  runLocalPlaywrightE2E({
    label: 'full',
    specPath: undefined,
  })
}

try {
  main()
} catch (error) {
  console.error('Full Playwright e2e checkpoint failed.')
  console.error(error)
  process.exitCode = 1
}
