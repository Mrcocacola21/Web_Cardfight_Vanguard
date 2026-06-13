import { runLocalPlaywrightE2E } from './run-local-playwright-e2e.mjs'

function main() {
  runLocalPlaywrightE2E({
    label: 'auth',
    specPath: 'tests/e2e/auth/routing.spec.ts',
  })
}

try {
  main()
} catch (error) {
  console.error('Auth e2e checkpoint failed.')
  console.error(error)
  process.exitCode = 1
}
