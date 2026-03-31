import { describe, it, expect } from 'vitest'
import { findEnvFile, loadEnv } from './env.js'
import { join } from 'path'
import { mkdtempSync, writeFileSync, mkdirSync, realpathSync } from 'fs'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

function makeTempDir(): string {
  // Resolve symlinks so paths are canonical on macOS (/var → /private/var)
  return realpathSync(mkdtempSync(join(tmpdir(), 'cognigy-test-')))
}

describe('findEnvFile', () => {
  it('returns path with fromWalk=false when .env exists in cwd', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, '.env'), 'COGNIGY_BASE_URL=x\nCOGNIGY_API_TOKEN=y')
    const result = findEnvFile(dir)
    expect(result).toEqual({ path: join(dir, '.env'), fromWalk: false })
  })

  it('returns null when no .env found anywhere', () => {
    const dir = makeTempDir()
    // No git repo, no .env
    const result = findEnvFile(dir)
    expect(result).toBeNull()
  })

  it('returns path with fromWalk=true when .env found via git root walk', () => {
    // Create a real git repo root with .env, and a subdirectory as cwd
    const root = makeTempDir()
    execSync('git init', { cwd: root, stdio: 'pipe' })
    writeFileSync(join(root, '.env'), 'COGNIGY_BASE_URL=x\nCOGNIGY_API_TOKEN=y')
    const subdir = join(root, 'src')
    mkdirSync(subdir)
    const result = findEnvFile(subdir)
    expect(result).toEqual({ path: join(root, '.env'), fromWalk: true })
  })

  it('returns null when startDir does not exist', () => {
    const result = findEnvFile('/nonexistent/path/that/cannot/exist')
    expect(result).toBeNull()
  })
})

describe('loadEnv', () => {
  it('parses required and optional vars from a .env file', () => {
    const dir = makeTempDir()
    const envPath = join(dir, '.env')
    writeFileSync(envPath, [
      'COGNIGY_BASE_URL=https://app.cognigy.ai',
      'COGNIGY_API_TOKEN=tok-123',
      'COGNIGY_PROJECT_ID=proj-456',
      'COGNIGY_FLOW_ID=flow-789',
    ].join('\n'))
    const config = loadEnv(envPath)
    expect(config).toEqual({
      baseUrl: 'https://app.cognigy.ai',
      apiToken: 'tok-123',
      projectId: 'proj-456',
      flowId: 'flow-789',
    })
  })

  it('throws when COGNIGY_BASE_URL is missing', () => {
    const dir = makeTempDir()
    const envPath = join(dir, '.env')
    writeFileSync(envPath, 'COGNIGY_API_TOKEN=tok-123')
    expect(() => loadEnv(envPath)).toThrow('COGNIGY_BASE_URL is required')
  })

  it('throws when COGNIGY_API_TOKEN is missing', () => {
    const dir = makeTempDir()
    const envPath = join(dir, '.env')
    writeFileSync(envPath, 'COGNIGY_BASE_URL=https://app.cognigy.ai')
    expect(() => loadEnv(envPath)).toThrow('COGNIGY_API_TOKEN is required')
  })

  it('omits optional vars when not set', () => {
    const dir = makeTempDir()
    const envPath = join(dir, '.env')
    writeFileSync(envPath, 'COGNIGY_BASE_URL=https://app.cognigy.ai\nCOGNIGY_API_TOKEN=tok-123')
    const config = loadEnv(envPath)
    expect(config.projectId).toBeUndefined()
    expect(config.flowId).toBeUndefined()
  })
})
