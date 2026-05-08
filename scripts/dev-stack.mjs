#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'

const PROJECT_ID = 'Web_VG'
const SUPABASE_VERSION = '2.88.0'
const STOP_TIMEOUT_SECONDS = 30
const LOG_TAIL_DEFAULT = '120'
const SUPABASE_EXCLUDES = ['logflare', 'vector', 'edge-runtime']

const isWindows = process.platform === 'win32'

function quoteArg(arg) {
  return /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg
}

function print(message = '') {
  process.stdout.write(`${message}\n`)
}

function fail(message, error) {
  print(`\n[dev-stack] ${message}`)
  if (error?.message) {
    print(error.message)
  }
  process.exit(1)
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
  })

  if (result.error) {
    if (options.allowFailure) {
      return result
    }
    fail(`Failed to run: ${command} ${args.join(' ')}`, result.error)
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1)
  }

  return result
}

function runCapture(command, args = [], options = {}) {
  return run(command, args, { ...options, capture: true })
}

function runCorepack(corepackArgs, options = {}) {
  if (!isWindows) {
    return run('corepack', corepackArgs, options)
  }

  return run(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', ['corepack', ...corepackArgs].map(quoteArg).join(' ')],
    options,
  )
}

function supabase(args, options = {}) {
  return runCorepack(
    ['pnpm', 'dlx', `supabase@${SUPABASE_VERSION}`, ...args],
    options,
  )
}

function ensureDocker() {
  const result = runCapture('docker', ['info'], { allowFailure: true })
  if (result.status !== 0) {
    fail(
      'Docker is not available. Start Docker Desktop, then retry the dev command.',
    )
  }
}

function dockerLines(args, options = {}) {
  const result = runCapture('docker', args, options)
  if (result.status !== 0) {
    return []
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function listProjectContainers() {
  const lines = dockerLines([
    'ps',
    '-a',
    '--filter',
    `label=com.supabase.cli.project=${PROJECT_ID}`,
    '--format',
    '{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Image}}',
  ])

  return lines.map((line) => {
    const [name = '', state = '', status = '', image = ''] = line.split('\t')
    return { name, state, status, image }
  })
}

function listProjectContainerNames() {
  return listProjectContainers().map((container) => container.name)
}

function listProjectVolumes() {
  return dockerLines([
    'volume',
    'ls',
    '--filter',
    `label=com.supabase.cli.project=${PROJECT_ID}`,
    '--format',
    '{{.Name}}',
  ])
}

function listProjectNetworks() {
  return dockerLines([
    'network',
    'ls',
    '--filter',
    `label=com.supabase.cli.project=${PROJECT_ID}`,
    '--format',
    '{{.Name}}',
  ])
}

function hasDbContainer() {
  return listProjectContainers().some(
    (container) => container.name === `supabase_db_${PROJECT_ID}`,
  )
}

function serviceToContainer(service) {
  if (!service) {
    return null
  }
  if (service.startsWith('supabase_')) {
    return service
  }

  const normalized = service.replaceAll('-', '_')
  return `supabase_${normalized}_${PROJECT_ID}`
}

function disableProjectRestarts() {
  const names = listProjectContainerNames()
  if (names.length === 0) {
    return
  }

  print(
    '[dev-stack] Disabling Supabase container restart policies before stop...',
  )
  run('docker', ['update', '--restart', 'no', ...names], {
    allowFailure: true,
  })
}

function stopProjectContainers() {
  const dbContainer = listProjectContainers().find(
    (container) =>
      container.name === `supabase_db_${PROJECT_ID}` &&
      container.state === 'running',
  )

  if (dbContainer) {
    print(
      '[dev-stack] Asking Postgres to shut down cleanly from inside the DB container...',
    )
    const result = run(
      'docker',
      [
        'exec',
        dbContainer.name,
        'sh',
        '-lc',
        'gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop',
      ],
      { allowFailure: true },
    )

    if (result.status !== 0) {
      const stoppedDb = listProjectContainers().find(
        (container) => container.name === dbContainer.name,
      )
      if (stoppedDb && stoppedDb.state !== 'running') {
        print('[dev-stack] Postgres exited after pg_ctl shutdown.')
      } else {
        print(
          '[dev-stack] pg_ctl shutdown failed; Docker stop will be used as fallback.',
        )
      }
    }
  }

  const targets = listProjectContainers()
    .filter(
      (container) =>
        container.name !== `supabase_db_${PROJECT_ID}` &&
        container.state === 'restarting',
    )
    .map((container) => container.name)

  if (targets.length === 0) {
    return
  }

  print(
    `[dev-stack] Gracefully stopping DB/restarting containers with ${STOP_TIMEOUT_SECONDS}s timeout...`,
  )
  run(
    'docker',
    ['stop', '--timeout', String(STOP_TIMEOUT_SECONDS), ...targets],
    { allowFailure: true },
  )
}

function removeProjectContainers() {
  const names = listProjectContainerNames()
  if (names.length === 0) {
    return
  }

  print('[dev-stack] Removing leftover Supabase containers...')
  run('docker', ['rm', '-f', ...names], { allowFailure: true })
}

function removeProjectNetworks() {
  const networks = listProjectNetworks()
  if (networks.length === 0) {
    return
  }

  print('[dev-stack] Removing leftover Supabase networks...')
  run('docker', ['network', 'rm', ...networks], { allowFailure: true })
}

function removeProjectVolumes() {
  const volumes = listProjectVolumes()
  if (volumes.length === 0) {
    return
  }

  print('[dev-stack] Removing Supabase data volumes...')
  run('docker', ['volume', 'rm', '-f', ...volumes], { allowFailure: true })
}

function cleanupStoppedOrRestartingContainers() {
  const stale = listProjectContainers()
    .filter((container) =>
      ['created', 'dead', 'exited', 'restarting'].includes(container.state),
    )
    .map((container) => container.name)

  if (stale.length === 0) {
    return
  }

  print('[dev-stack] Removing stale Supabase containers before start...')
  run('docker', ['update', '--restart', 'no', ...stale], {
    allowFailure: true,
  })
  run('docker', ['rm', '-f', ...stale], { allowFailure: true })
}

function validateContainerState() {
  const containers = listProjectContainers()
  const bad = containers.filter((container) => {
    const status = container.status.toLowerCase()
    return (
      container.state === 'restarting' ||
      container.state === 'dead' ||
      status.includes('unhealthy')
    )
  })

  if (bad.length === 0) {
    print(
      '[dev-stack] Supabase containers are running without unhealthy/restarting services.',
    )
    return
  }

  print('[dev-stack] Supabase started, but at least one service is unhealthy:')
  for (const container of bad) {
    print(`  - ${container.name}: ${container.status}`)
  }
  print('[dev-stack] Run `corepack pnpm dev:logs` for diagnostics.')
  process.exit(1)
}

function printDockerStatus() {
  run('docker', [
    'ps',
    '-a',
    '--filter',
    `label=com.supabase.cli.project=${PROJECT_ID}`,
    '--format',
    'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}',
  ])
}

function printPreservedVolumes() {
  const volumes = listProjectVolumes()
  if (volumes.length === 0) {
    print('[dev-stack] No Supabase data volumes are present.')
    return
  }

  print('[dev-stack] Preserved Supabase data volumes:')
  for (const volume of volumes) {
    print(`  - ${volume}`)
  }
}

function startStack() {
  ensureDocker()

  cleanupStoppedOrRestartingContainers()
  removeProjectNetworks()

  print('[dev-stack] Starting local Supabase stack...')
  supabase(['start', '--exclude', SUPABASE_EXCLUDES.join(',')])

  validateContainerState()
  print('[dev-stack] Local Supabase endpoints:')
  supabase(['status'])
}

function downStack() {
  ensureDocker()

  disableProjectRestarts()
  stopProjectContainers()

  print(
    '[dev-stack] Stopping Supabase through the CLI; data volumes are preserved...',
  )
  supabase(['stop', '--project-id', PROJECT_ID], { allowFailure: true })

  removeProjectContainers()
  removeProjectNetworks()
  printPreservedVolumes()
}

function restartStack() {
  downStack()
  startStack()
}

function resetDatabase() {
  ensureDocker()

  if (!hasDbContainer()) {
    startStack()
  }

  print('[dev-stack] Resetting local database with migrations and seed...')
  supabase(['db', 'reset', '--local'])
  validateContainerState()
}

function hardResetStack() {
  ensureDocker()

  disableProjectRestarts()
  stopProjectContainers()

  print('[dev-stack] Stopping Supabase and deleting project data volumes...')
  supabase(['stop', '--project-id', PROJECT_ID, '--no-backup'], {
    allowFailure: true,
  })

  removeProjectContainers()
  removeProjectNetworks()
  removeProjectVolumes()
  startStack()
}

function status() {
  ensureDocker()

  const containers = listProjectContainers()
  if (containers.length === 0) {
    print('[dev-stack] No Supabase containers are running for this repo.')
    printPreservedVolumes()
    return
  }

  printDockerStatus()

  if (hasDbContainer()) {
    print('')
    supabase(['status'], { allowFailure: true })
  }

  const problematic = containers.filter((container) => {
    const statusText = container.status.toLowerCase()
    return (
      container.state === 'restarting' ||
      container.state === 'dead' ||
      statusText.includes('unhealthy') ||
      statusText.includes('exited')
    )
  })

  if (problematic.length === 0) {
    print(
      '[dev-stack] No unhealthy, exited, or restarting Supabase containers detected.',
    )
    return
  }

  print('[dev-stack] Containers needing attention:')
  for (const container of problematic) {
    print(`  - ${container.name}: ${container.status}`)
  }
}

function parseLogOptions(args) {
  let follow = false
  let tail = LOG_TAIL_DEFAULT
  let service = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') {
      continue
    }
    if (arg === '--follow' || arg === '-f') {
      follow = true
      continue
    }
    if (arg === '--tail') {
      tail = args[index + 1] ?? LOG_TAIL_DEFAULT
      index += 1
      continue
    }
    if (arg.startsWith('--tail=')) {
      tail = arg.slice('--tail='.length)
      continue
    }
    service = arg
  }

  return { follow, tail, service }
}

function prefixStream(stream, prefix, output) {
  let pending = ''
  stream.on('data', (chunk) => {
    pending += chunk.toString()
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      output.write(`[${prefix}] ${line}\n`)
    }
  })
  stream.on('end', () => {
    if (pending.length > 0) {
      output.write(`[${prefix}] ${pending}\n`)
    }
  })
}

function logs(args) {
  ensureDocker()

  const { follow, tail, service } = parseLogOptions(args)
  const containers = listProjectContainers()
  if (containers.length === 0) {
    print(
      '[dev-stack] No Supabase containers found. Run `corepack pnpm dev:up` first.',
    )
    return
  }

  const targets = service
    ? [serviceToContainer(service)]
    : containers.map((container) => container.name)

  const missing = targets.filter(
    (target) => !containers.some((container) => container.name === target),
  )
  if (missing.length > 0) {
    fail(`Unknown Supabase container/service: ${missing.join(', ')}`)
  }

  if (!follow) {
    for (const target of targets) {
      print(`\n[dev-stack] Logs: ${target}`)
      run('docker', ['logs', '--tail', tail, target], { allowFailure: true })
    }
    return
  }

  print('[dev-stack] Following logs. Press Ctrl+C to stop.')
  const children = targets.map((target) => {
    const child = spawn(
      'docker',
      ['logs', '--tail', tail, '--follow', target],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      },
    )
    prefixStream(child.stdout, target, process.stdout)
    prefixStream(child.stderr, target, process.stderr)
    return child
  })

  process.on('SIGINT', () => {
    for (const child of children) {
      child.kill('SIGTERM')
    }
    process.exit(0)
  })
}

function usage() {
  print(`Usage: node scripts/dev-stack.mjs <command>

Commands:
  up             Start local Supabase containers.
  down           Gracefully stop containers and preserve Supabase volumes.
  restart        Run down, then up.
  status         Show Supabase container health and URLs.
  logs [svc]     Show logs for all services or one service, e.g. db/kong/auth.
  reset          Reset the local DB with migrations and seed; keep Docker volumes.
  hard-reset     Stop, remove project containers/networks/volumes, then start clean.

Log options:
  --follow, -f   Follow logs.
  --tail <n>     Number of lines per container. Default: ${LOG_TAIL_DEFAULT}.
`)
}

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  case 'up':
    startStack()
    break
  case 'down':
    downStack()
    break
  case 'restart':
    restartStack()
    break
  case 'status':
    status()
    break
  case 'logs':
    logs(rest)
    break
  case 'reset':
    resetDatabase()
    break
  case 'hard-reset':
    hardResetStack()
    break
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    usage()
    break
  default:
    usage()
    process.exit(1)
}
