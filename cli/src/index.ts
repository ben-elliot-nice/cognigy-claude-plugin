#!/usr/bin/env node
import { findEnvFile, loadEnv } from './lib/env.js'
import { createClient } from './lib/client.js'
import type { ResourceRegistry } from './lib/types.js'

// Resource registry — add new modules here as they're generated
const registry: ResourceRegistry = {}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg?.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1]
      if (value && !value.startsWith('--')) {
        flags[key] = value
        i++
      }
    }
  }
  return flags
}

async function runInit(): Promise<void> {
  const { existsSync, writeFileSync } = await import('fs')
  const { resolve } = await import('path')
  const envPath = resolve(process.cwd(), '.env')

  if (existsSync(envPath)) {
    output({ message: '.env already exists — skipping', path: envPath })
    return
  }

  const template = [
    '# Cognigy Claude Plugin — Project Configuration',
    '',
    '# Required',
    'COGNIGY_BASE_URL=https://app.cognigy.ai',
    'COGNIGY_API_TOKEN=',
    '',
    '# Optional defaults (overridable per CLI call)',
    'COGNIGY_PROJECT_ID=',
    'COGNIGY_FLOW_ID=',
  ].join('\n') + '\n'

  writeFileSync(envPath, template)
  output({ message: '.env created', path: envPath })
}

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

function fail(message: string, exitCode = 1): never {
  console.error(JSON.stringify({ error: message }))
  process.exit(exitCode)
}

async function main(): Promise<void> {
  const [, , verb, resource, thirdArg, ...rest] = process.argv

  if (verb === 'init') {
    await runInit()
    return
  }

  if (!verb || !resource) {
    fail('Usage: cognigy <verb> <resource> [id] [--option value ...]')
  }

  const flags = parseFlags([thirdArg ?? '', ...rest].filter(Boolean))
  const explicitEnvPath = flags['env-path']
  delete flags['env-path']  // don't forward meta-flags to resource handlers

  // Resolve .env
  let envPath: string
  if (explicitEnvPath) {
    envPath = explicitEnvPath
  } else {
    const found = findEnvFile(process.cwd())
    if (!found) {
      fail('No .env file found. Run: cognigy init')
    }
    if (found.fromWalk) {
      // Signal to skill that user confirmation is needed
      output({ requiresConfirmation: true, path: found.path })
      process.exit(2)
    }
    envPath = found.path
  }

  const env = loadEnv(envPath)
  const client = createClient(env)

  const handlers = registry[resource]
  if (!handlers) {
    fail(`Unknown resource: "${resource}". Available: ${Object.keys(registry).join(', ') || 'none registered yet'}`)
  }

  // Determine if thirdArg is an ID (not a flag)
  const id = thirdArg && !thirdArg.startsWith('--') ? thirdArg : undefined

  switch (verb) {
    case 'list': {
      if (!handlers.list) fail(`Resource "${resource}" does not support list`)
      output(await handlers.list(client, env))
      break
    }
    case 'get': {
      if (!id) fail(`get requires an ID: cognigy get ${resource} <id>`)
      if (!handlers.get) fail(`Resource "${resource}" does not support get`)
      output(await handlers.get(id, client, env))
      break
    }
    case 'create': {
      if (!handlers.create) fail(`Resource "${resource}" does not support create`)
      output(await handlers.create(flags, client, env))
      break
    }
    case 'update': {
      if (!id) fail(`update requires an ID: cognigy update ${resource} <id> --field value`)
      if (!handlers.update) fail(`Resource "${resource}" does not support update`)
      output(await handlers.update(id, flags, client, env))
      break
    }
    case 'delete': {
      if (!id) fail(`delete requires an ID: cognigy delete ${resource} <id>`)
      if (!handlers.delete) fail(`Resource "${resource}" does not support delete`)
      await handlers.delete(id, client, env)
      output({ deleted: true, resource, id })
      break
    }
    default:
      fail(`Unknown verb: "${verb}". Valid verbs: list, get, create, update, delete`)
  }
}

main().catch(err => {
  console.error(JSON.stringify({ error: (err as Error).message }))
  process.exit(1)
})
