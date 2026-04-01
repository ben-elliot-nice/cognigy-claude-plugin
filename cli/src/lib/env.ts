import { existsSync, readFileSync, realpathSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'
import type { EnvConfig, EnvFindResult } from './types.js'

function parseEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

export function findEnvFile(startDir: string): EnvFindResult | null {
  // Resolve symlinks so paths are canonical on macOS (/var → /private/var)
  let realStartDir: string
  try {
    realStartDir = realpathSync(startDir)
  } catch {
    return null
  }
  const cwdEnv = resolve(realStartDir, '.env')
  if (existsSync(cwdEnv)) {
    return { path: cwdEnv, fromWalk: false }
  }

  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: realStartDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim()

    const gitEnv = resolve(gitRoot, '.env')
    if (gitEnv !== cwdEnv && existsSync(gitEnv)) {
      return { path: gitEnv, fromWalk: true }
    }
  } catch {
    // Not in a git repo or git unavailable — skip walk
  }

  return null
}

export function loadEnv(envPath: string): EnvConfig {
  const raw = readFileSync(envPath, 'utf8')
  const parsed = parseEnv(raw)

  if (!parsed['COGNIGY_BASE_URL']) throw new Error('COGNIGY_BASE_URL is required in .env')
  if (!parsed['COGNIGY_API_TOKEN']) throw new Error('COGNIGY_API_TOKEN is required in .env')

  return {
    baseUrl: parsed['COGNIGY_BASE_URL'],
    apiToken: parsed['COGNIGY_API_TOKEN'],
    projectId: parsed['COGNIGY_PROJECT_ID'] || undefined,
    flowId: parsed['COGNIGY_FLOW_ID'] || undefined,
  }
}
