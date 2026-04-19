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

function tryRunCorepack(corepackArgs, env = process.env) {
  try {
    return runCorepack(corepackArgs, '', env)
  } catch {
    return null
  }
}

function waitMs(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function waitForSupabaseStop() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusOutput = tryRunCorepack([
      'pnpm',
      'dlx',
      `supabase@${cliVersion}`,
      'status',
    ])

    if (statusOutput === null) {
      return
    }

    waitMs(1_000)
  }
}

function startLocalSupabase() {
  try {
    return runCorepack(
      ['pnpm', 'dlx', `supabase@${cliVersion}`, 'start'],
      'Failed to start local Supabase services.\n',
    )
  } catch (error) {
    if (
      error instanceof Error &&
      /(container name .* is already in use|container is not ready: starting)/iu.test(
        error.message,
      )
    ) {
      waitMs(5_000)

      return runCorepack(
        ['pnpm', 'dlx', `supabase@${cliVersion}`, 'start'],
        'Failed to start local Supabase services.\n',
      )
    }

    throw error
  }
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

  tryRunCorepack([
    'pnpm',
    'dlx',
    `supabase@${cliVersion}`,
    'stop',
    '--no-backup',
  ])
  waitForSupabaseStop()

  startLocalSupabase()

  runCorepack(
    ['pnpm', 'dlx', `supabase@${cliVersion}`, 'db', 'reset', '--local'],
    'Failed to reset the local Supabase database.\n',
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
