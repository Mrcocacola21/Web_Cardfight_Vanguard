import { spawnSync } from 'node:child_process'

import { createDbClient, createImporterRepository } from '@web-vg/db'

import {
  createDevJsonImportRunner,
  readDevJsonImportDocumentFromFile,
} from './dev-json-importer'

const cliVersion = '2.88.0'

async function main() {
  const filePath = resolveFilePath(process.argv.slice(2))

  if (!filePath) {
    printUsage()
    process.exitCode = 1
    return
  }

  const documentResult = await readDevJsonImportDocumentFromFile(filePath)

  if (!documentResult.ok) {
    printError(documentResult.error.message, documentResult.error.details)
    process.exitCode = 1
    return
  }

  const adminConfig = resolveSupabaseAdminConfig()

  if (!adminConfig.ok) {
    printError(adminConfig.error.message, adminConfig.error.details)
    process.exitCode = 1
    return
  }

  const client = createDbClient({
    url: adminConfig.data.url,
    serviceRoleKey: adminConfig.data.serviceRoleKey,
  })
  const repository = createImporterRepository(client)
  const runner = createDevJsonImportRunner(repository)
  const result = await runner.run({
    document: documentResult.data.document,
    filePath: documentResult.data.filePath,
  })

  if (!result.ok) {
    printError(result.error.message, result.error.details)
    process.exitCode = 1
    return
  }

  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`)
}

function resolveFilePath(args: readonly string[]) {
  const normalizedArgs = args.filter((arg) => arg !== '--')
  const firstArg = normalizedArgs[0]

  if (!firstArg || firstArg === '--help' || firstArg === '-h') {
    return null
  }

  return firstArg
}

function printUsage() {
  process.stdout.write(
    'Usage: pnpm importer:dev-json -- <path-to-dev-json-fixture>\n',
  )
}

function printError(message: string, details?: string) {
  process.stderr.write(`${message}\n`)

  if (details) {
    process.stderr.write(`${details}\n`)
  }
}

function resolveSupabaseAdminConfig():
  | {
      readonly ok: true
      readonly data: {
        readonly url: string
        readonly serviceRoleKey: string
      }
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
        readonly details?: string
      }
    } {
  const explicitUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  const explicitServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    null

  if (explicitUrl && explicitServiceRoleKey) {
    return {
      ok: true,
      data: {
        url: explicitUrl,
        serviceRoleKey: explicitServiceRoleKey,
      },
    }
  }

  const envMapResult = readSupabaseStatusEnv()

  if (!envMapResult.ok) {
    return envMapResult
  }

  const url = explicitUrl ?? envMapResult.data.API_URL ?? null
  const serviceRoleKey =
    explicitServiceRoleKey ?? envMapResult.data.SERVICE_ROLE_KEY ?? null

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      error: {
        message:
          'Failed to resolve Supabase admin credentials for dev JSON import.',
        details:
          'Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or run local Supabase so `supabase status -o env` exposes API_URL and SERVICE_ROLE_KEY.',
      },
    }
  }

  return {
    ok: true,
    data: {
      url,
      serviceRoleKey,
    },
  }
}

function readSupabaseStatusEnv():
  | {
      readonly ok: true
      readonly data: Record<string, string>
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
        readonly details?: string
      }
    } {
  const command = [
    'corepack',
    'pnpm',
    'dlx',
    `supabase@${cliVersion}`,
    'status',
    '-o',
    'env',
  ]
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', quoteShellArgs(command)],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: process.env,
            maxBuffer: 20 * 1024 * 1024,
          },
        )
      : spawnSync(command[0]!, command.slice(1), {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: process.env,
          maxBuffer: 20 * 1024 * 1024,
        })

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error: {
        message:
          'Failed to resolve local Supabase credentials for dev JSON import.',
        details:
          result.stderr ||
          result.error?.message ||
          'Local Supabase status command did not succeed.',
      },
    }
  }

  return {
    ok: true,
    data: parseEnvOutput(result.stdout),
  }
}

function parseEnvOutput(output: string) {
  const entries = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf('=')
      const key = line.slice(0, separatorIndex)
      const rawValue = line.slice(separatorIndex + 1)
      const value =
        rawValue.startsWith('"') && rawValue.endsWith('"')
          ? rawValue.slice(1, -1)
          : rawValue
      return [key, value] as const
    })

  return Object.fromEntries(entries)
}

function quoteShellArgs(args: readonly string[]) {
  return args
    .map((arg) =>
      /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg,
    )
    .join(' ')
}

void main()
