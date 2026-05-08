import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cliVersion = '2.88.0'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')
const localBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

function quoteArg(arg) {
  return /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg
}

function runCorepack(corepackArgs, fallbackMessage, env = process.env) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          [
            '/d',
            '/s',
            '/c',
            ['corepack', ...corepackArgs].map(quoteArg).join(' '),
          ],
          {
            cwd: repoRoot,
            encoding: 'utf8',
            env,
            maxBuffer: 20 * 1024 * 1024,
            stdio: 'pipe',
          },
        )
      : spawnSync('corepack', corepackArgs, {
          cwd: repoRoot,
          encoding: 'utf8',
          env,
          maxBuffer: 20 * 1024 * 1024,
          stdio: 'pipe',
        })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || fallbackMessage)
  }

  return result.stdout
}

function parseStatusEnv(statusOutput, name) {
  const match = statusOutput.match(new RegExp(`${name}="([^"]+)"`, 'u'))
  return match?.[1] ?? null
}

function assert(value, message) {
  if (!value) {
    throw new Error(message)
  }
}

export function runLocalPlaywrightE2E({ label, specPath }) {
  console.log(`Preparing local Supabase services for ${label} e2e smoke...`)

  runCorepack(
    ['pnpm', 'dev:hard-reset'],
    'Failed to hard reset local Supabase services.\n',
  )

  const statusOutput = runCorepack(
    ['pnpm', 'dlx', `supabase@${cliVersion}`, 'status', '-o', 'env'],
    'Failed to resolve local Supabase environment values.\n',
  )

  const apiUrl = parseStatusEnv(statusOutput, 'API_URL')
  const anonKey = parseStatusEnv(statusOutput, 'ANON_KEY')

  assert(
    apiUrl,
    'Local Supabase auth/api services are not running. `supabase status -o env` did not expose API_URL.',
  )
  assert(
    anonKey,
    'Local Supabase auth/api services are not running. `supabase status -o env` did not expose ANON_KEY.',
  )

  const env = {
    ...process.env,
    CI: '1',
    NEXT_PUBLIC_APP_ORIGIN: localBaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    PLAYWRIGHT_BASE_URL: localBaseUrl,
    PLAYWRIGHT_USE_LOCAL_SUPABASE: '1',
  }

  const output = runCorepack(
    ['pnpm', 'exec', 'playwright', 'test', specPath],
    `${label} Playwright smoke tests failed.\n`,
    env,
  )

  process.stdout.write(output)
}
