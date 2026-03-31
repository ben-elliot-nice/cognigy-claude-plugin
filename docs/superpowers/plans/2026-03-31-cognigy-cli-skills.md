# Cognigy CLI + Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CLI shell, env discovery, HTTP client, flows resource module, and 4 atomic CRUD skills — proving the end-to-end architecture before scaling resource coverage.

**Architecture:** Skills invoke a TypeScript CLI bundled in the plugin via `npx tsx`. Per-project config lives in a `.env` in the consuming repo. Resource-specific logic lives in TS modules (`resources/*.ts`); atomic skills stay generic across all resources.

**Tech Stack:** TypeScript, tsx (no build step), Vitest, dotenv, Node 24 native fetch.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `skills/xapp/`, `skills/code-node/`, `skills/aiagent-tool/`, `skills/aiagent-persona/`, `skills/api/` | Delete | Remove empty placeholders |
| `cli/package.json` | Create | CLI package — tsx, vitest, dotenv |
| `cli/tsconfig.json` | Create | TypeScript config for ESM |
| `cli/src/lib/types.ts` | Create | Shared types: `CognigyClient`, `EnvConfig`, `ResourceHandlers`, `ResourceRegistry` |
| `cli/src/lib/env.ts` | Create | `.env` discovery: cwd → git root walk with confirmation signal |
| `cli/src/lib/env.test.ts` | Create | Unit tests for env discovery |
| `cli/src/lib/client.ts` | Create | HTTP client factory using `EnvConfig` |
| `cli/src/lib/client.test.ts` | Create | Unit tests for HTTP client |
| `cli/src/index.ts` | Create | CLI entry point: arg parsing, env loading, resource routing, `init` command |
| `cli/openapi/cognigy.yaml` | Create (manual) | Cognigy OpenAPI spec — placed by user |
| `cli/src/resources/flows.ts` | Create | Flow CRUD handlers — first resource module |
| `cli/src/resources/flows.test.ts` | Create | Unit tests for flows module |
| `skills/get/SKILL.md` | Create | Atomic get skill |
| `skills/create/SKILL.md` | Create | Atomic create skill |
| `skills/update/SKILL.md` | Create | Atomic update skill |
| `skills/delete/SKILL.md` | Create | Atomic delete skill |

---

## Task 1: Remove placeholder skill directories

**Files:**
- Delete: `skills/xapp/`, `skills/code-node/`, `skills/aiagent-tool/`, `skills/aiagent-persona/`, `skills/api/`

- [ ] **Step 1: Remove the directories**

```bash
rm -rf skills/xapp skills/code-node skills/aiagent-tool skills/aiagent-persona skills/api
```

- [ ] **Step 2: Verify they're gone**

```bash
ls skills/
```

Expected: empty output (no directories listed).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove placeholder skill directories"
```

---

## Task 2: Set up CLI package

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`

- [ ] **Step 1: Create cli/package.json**

```json
{
  "name": "@cognigy-claude-plugin/cli",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd cli && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Commit**

```bash
git add cli/package.json cli/tsconfig.json cli/package-lock.json
git commit -m "chore: scaffold CLI package"
```

---

## Task 3: Write shared types

**Files:**
- Create: `cli/src/lib/types.ts`

No tests for this task — it's pure type definitions.

- [ ] **Step 1: Create cli/src/lib/types.ts**

```typescript
export interface EnvConfig {
  baseUrl: string
  apiToken: string
  projectId?: string
  flowId?: string
}

export interface CognigyClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  delete(path: string): Promise<void>
}

export type ResourceHandlers = {
  get?: (id: string, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  create?: (params: Record<string, unknown>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  update?: (id: string, params: Record<string, unknown>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  delete?: (id: string, client: CognigyClient, env: EnvConfig) => Promise<void>
}

export type ResourceRegistry = Record<string, ResourceHandlers>

export interface EnvFindResult {
  path: string
  fromWalk: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add cli/src/lib/types.ts
git commit -m "feat: add shared CLI types"
```

---

## Task 4: Write env discovery (TDD)

**Files:**
- Create: `cli/src/lib/env.ts`
- Create: `cli/src/lib/env.test.ts`

- [ ] **Step 1: Write failing tests**

Create `cli/src/lib/env.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { findEnvFile, loadEnv } from './env.js'
import { join } from 'path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'cognigy-test-'))
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
    // Create a fake git root with .env, and a subdirectory as cwd
    const root = makeTempDir()
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.env'), 'COGNIGY_BASE_URL=x\nCOGNIGY_API_TOKEN=y')
    const subdir = join(root, 'src')
    mkdirSync(subdir)
    const result = findEnvFile(subdir)
    expect(result).toEqual({ path: join(root, '.env'), fromWalk: true })
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd cli && npm test
```

Expected: multiple test failures — `env.js` not found.

- [ ] **Step 3: Write cli/src/lib/env.ts**

```typescript
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'
import { parse } from 'dotenv'
import type { EnvConfig, EnvFindResult } from './types.js'

export function findEnvFile(startDir: string): EnvFindResult | null {
  const cwdEnv = resolve(startDir, '.env')
  if (existsSync(cwdEnv)) {
    return { path: cwdEnv, fromWalk: false }
  }

  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: startDir,
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
  const parsed = parse(raw)

  if (!parsed['COGNIGY_BASE_URL']) throw new Error('COGNIGY_BASE_URL is required in .env')
  if (!parsed['COGNIGY_API_TOKEN']) throw new Error('COGNIGY_API_TOKEN is required in .env')

  return {
    baseUrl: parsed['COGNIGY_BASE_URL'],
    apiToken: parsed['COGNIGY_API_TOKEN'],
    projectId: parsed['COGNIGY_PROJECT_ID'] || undefined,
    flowId: parsed['COGNIGY_FLOW_ID'] || undefined,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd cli && npm test
```

Expected: all tests in `env.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/env.ts cli/src/lib/env.test.ts
git commit -m "feat: add env discovery with cwd → git root walk"
```

---

## Task 5: Write HTTP client (TDD)

**Files:**
- Create: `cli/src/lib/client.ts`
- Create: `cli/src/lib/client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `cli/src/lib/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from './client.js'
import type { EnvConfig } from './types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('createClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(200, { _id: 'abc' }))
  })

  it('GET sets Authorization header and calls correct URL', async () => {
    const client = createClient(env)
    await client.get('/flows/abc')
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('POST sends JSON body', async () => {
    const client = createClient(env)
    await client.post('/projects/proj/flows', { name: 'My Flow' })
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/projects/proj/flows',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'My Flow' }),
      })
    )
  })

  it('PATCH sends JSON body', async () => {
    const client = createClient(env)
    await client.patch('/flows/abc', { name: 'Renamed' })
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('DELETE calls correct URL', async () => {
    vi.stubGlobal('fetch', mockFetch(204, null))
    const client = createClient(env)
    await client.delete('/flows/abc')
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { message: 'Unauthorized' }))
    const client = createClient(env)
    await expect(client.get('/flows/abc')).rejects.toThrow('401')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd cli && npm test
```

Expected: failures — `client.js` not found.

- [ ] **Step 3: Write cli/src/lib/client.ts**

```typescript
import type { CognigyClient, EnvConfig } from './types.js'

export function createClient(env: EnvConfig): CognigyClient {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.apiToken}`,
    'Content-Type': 'application/json',
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${env.baseUrl}/v2.0${path}`
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Cognigy API error ${res.status}: ${text}`)
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    get:    (path) => request('GET', path),
    post:   (path, body) => request('POST', path, body),
    patch:  (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd cli && npm test
```

Expected: all tests in `client.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/client.ts cli/src/lib/client.test.ts
git commit -m "feat: add HTTP client with auth and error handling"
```

---

## Task 6: Write CLI entry point

**Files:**
- Create: `cli/src/index.ts`

No unit tests — this is integration-level wiring. Validated end-to-end in Task 10.

- [ ] **Step 1: Create cli/src/index.ts**

```typescript
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
      fail(`Unknown verb: "${verb}". Valid verbs: get, create, update, delete`)
  }
}

main().catch(err => {
  console.error(JSON.stringify({ error: (err as Error).message }))
  process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
git add cli/src/index.ts
git commit -m "feat: add CLI entry point with routing, init command, and env-path flag"
```

---

## Task 7: Place the Cognigy OpenAPI spec

**Files:**
- Create: `cli/openapi/cognigy.yaml` (manual — user action)

This task cannot be automated. The Cognigy OpenAPI spec must be obtained from your Cognigy environment.

- [ ] **Step 1: Obtain the OpenAPI spec**

Option A — from your Cognigy environment:
Navigate to `https://<your-cognigy-url>/openapi.yaml` or check your Cognigy admin panel for an API reference download link.

Option B — from Cognigy docs:
Check https://docs.cognigy.com for a downloadable OpenAPI/Swagger spec.

- [ ] **Step 2: Place the spec**

```bash
mkdir -p cli/openapi
# Copy your obtained spec to:
cp /path/to/cognigy-spec.yaml cli/openapi/cognigy.yaml
```

- [ ] **Step 3: Verify the spec is valid YAML and contains flow endpoints**

```bash
grep -i "flows" cli/openapi/cognigy.yaml | head -20
```

Expected: lines referencing `/flows` endpoints.

- [ ] **Step 4: Commit**

```bash
git add cli/openapi/cognigy.yaml
git commit -m "feat: bundle Cognigy OpenAPI spec"
```

---

## Task 8: Write flows resource module (TDD)

**Files:**
- Create: `cli/src/resources/flows.ts`
- Create: `cli/src/resources/flows.test.ts`

**Meta-skill alternative:** If you have the personal meta-skill available, use it to generate `flows.ts` from the OpenAPI spec instead of writing it by hand — then compare the output to the code below. That comparison is Q1 of the validation experiment.

Before writing, open `cli/openapi/cognigy.yaml` and find the flows endpoints. Look for paths containing `/flows` and note the exact path patterns, required parameters, and response shapes. The code below uses the standard Cognigy v2.0 REST API patterns — verify each path against the spec and adjust if different.

- [ ] **Step 1: Write failing tests**

Create `cli/src/resources/flows.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flows } from './flows.js'
import type { CognigyClient, EnvConfig } from '../lib/types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
  projectId: 'proj-123',
}

const mockFlow = {
  _id: 'flow-abc',
  name: 'Test Flow',
  projectId: 'proj-123',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function makeClient(overrides: Partial<CognigyClient> = {}): CognigyClient {
  return {
    get: vi.fn().mockResolvedValue(mockFlow),
    post: vi.fn().mockResolvedValue(mockFlow),
    patch: vi.fn().mockResolvedValue(mockFlow),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('flows.get', () => {
  it('calls GET /flows/:id and returns the flow', async () => {
    const client = makeClient()
    const result = await flows.get!('flow-abc', client, env)
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc')
    expect(result).toEqual(mockFlow)
  })
})

describe('flows.create', () => {
  it('calls POST /projects/:projectId/flows with name', async () => {
    const client = makeClient()
    await flows.create!({ name: 'New Flow' }, client, env)
    expect(client.post).toHaveBeenCalledWith(
      '/projects/proj-123/flows',
      expect.objectContaining({ name: 'New Flow' })
    )
  })

  it('throws when projectId is missing from env and params', async () => {
    const client = makeClient()
    const envWithoutProject: EnvConfig = { baseUrl: 'x', apiToken: 'y' }
    await expect(flows.create!({ name: 'New Flow' }, client, envWithoutProject))
      .rejects.toThrow('projectId')
  })

  it('uses projectId from params when provided, overriding env default', async () => {
    const client = makeClient()
    await flows.create!({ name: 'New Flow', projectId: 'proj-override' }, client, env)
    expect(client.post).toHaveBeenCalledWith(
      '/projects/proj-override/flows',
      expect.objectContaining({ name: 'New Flow' })
    )
  })
})

describe('flows.update', () => {
  it('calls PATCH /flows/:id with update params', async () => {
    const client = makeClient()
    await flows.update!('flow-abc', { name: 'Renamed' }, client, env)
    expect(client.patch).toHaveBeenCalledWith(
      '/flows/flow-abc',
      expect.objectContaining({ name: 'Renamed' })
    )
  })
})

describe('flows.delete', () => {
  it('calls DELETE /flows/:id', async () => {
    const client = makeClient()
    await flows.delete!('flow-abc', client, env)
    expect(client.delete).toHaveBeenCalledWith('/flows/flow-abc')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd cli && npm test
```

Expected: failures — `flows.js` not found.

- [ ] **Step 3: Write cli/src/resources/flows.ts**

Verify the API paths below against `cli/openapi/cognigy.yaml` before committing.

```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

export interface Flow {
  _id: string
  name: string
  projectId: string
  description?: string
  createdAt: string
  updatedAt: string
}

function resolveProjectId(
  params: Record<string, unknown>,
  env: EnvConfig
): string {
  const id = (params['projectId'] as string | undefined) ?? env.projectId
  if (!id) throw new Error('projectId is required — set COGNIGY_PROJECT_ID in .env or pass --projectId')
  return id
}

export const flows: ResourceHandlers = {
  async get(id, client) {
    return client.get<Flow>(`/flows/${id}`)
  },

  async create(params, client, env) {
    const projectId = resolveProjectId(params, env)
    const { projectId: _omit, ...body } = params
    return client.post<Flow>(`/projects/${projectId}/flows`, body)
  },

  async update(id, params, client) {
    return client.patch<Flow>(`/flows/${id}`, params)
  },

  async delete(id, client) {
    return client.delete(`/flows/${id}`)
  },
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd cli && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add cli/src/resources/flows.ts cli/src/resources/flows.test.ts
git commit -m "feat: add flows resource module with CRUD handlers"
```

---

## Task 9: Wire flows into the CLI registry

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Add flows import and register it**

In `cli/src/index.ts`, replace:

```typescript
// Resource registry — add new modules here as they're generated
const registry: ResourceRegistry = {}
```

With:

```typescript
import { flows } from './resources/flows.js'

// Resource registry — add new modules here as they're generated
const registry: ResourceRegistry = {
  flow: flows,
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
cd cli && npm test
```

Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add cli/src/index.ts
git commit -m "feat: register flows module in CLI router"
```

---

## Task 10: Write atomic CRUD skills

**Files:**
- Create: `skills/get/SKILL.md`
- Create: `skills/create/SKILL.md`
- Create: `skills/update/SKILL.md`
- Create: `skills/delete/SKILL.md`

The plugin install path is the directory containing `skills/`. Claude Code loads skills from `~/.claude/plugins/<plugin-name>/skills/`, so the CLI is at `~/.claude/plugins/<plugin-name>/cli/src/index.ts`. Skills use `COGNIGY_PLUGIN_DIR` as a shorthand — instruct Claude to resolve it from the plugin's known location.

- [ ] **Step 1: Create skills/get/SKILL.md**

```markdown
---
description: Get a Cognigy resource by ID and return it as JSON
---

# Cognigy Get

Retrieve a Cognigy resource by ID.

## When to Use

Use this skill when the user wants to fetch a specific Cognigy resource: a flow, AI agent, endpoint, or any other resource type supported by the CLI.

## Steps

1. Identify the resource type and ID from the user's request.

2. Run the CLI:

```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts get <resource> <id>
```

Replace `<resource>` with the resource type (e.g. `flow`) and `<id>` with the resource ID.

3. Check the output:
   - **Exit code 0** — success. Parse the JSON output and present the result to the user, or pass it to the next step in a composite skill.
   - **Exit code 2** — the `.env` was found via git root walk, not in the current directory. The output will contain `{ "requiresConfirmation": true, "path": "..." }`. Show the user the `.env` path and ask: *"I found a .env at `<path>` — is it OK to use this for the Cognigy connection?"* If they confirm, re-run with `--env-path <path>`. If they decline, stop.
   - **Exit code 1** — error. Show the user the `error` field from the JSON output. Common fixes:
     - `No .env file found` → ask user to run `cognigy init` in their project root
     - `API error 401` → the API token in `.env` is invalid or expired
     - `Unknown resource` → the resource type isn't supported yet

## Output

All output is JSON. For a `get flow` call, the result will look like:

```json
{
  "_id": "abc123",
  "name": "My Flow",
  "projectId": "proj-456",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## Notes

- Do not guess resource IDs — always ask the user if you don't have them.
- The `flow` resource requires `COGNIGY_PROJECT_ID` in `.env` for `create` operations but not for `get`.
```

- [ ] **Step 2: Create skills/create/SKILL.md**

```markdown
---
description: Create a new Cognigy resource
---

# Cognigy Create

Create a new Cognigy resource.

## When to Use

Use this skill when the user wants to create a new resource: a flow, AI agent, endpoint, or any other resource type supported by the CLI.

## Steps

1. Identify the resource type and the required parameters from the user's request. If any required parameters are missing, ask for them before proceeding.

2. Run the CLI:

```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts create <resource> --<param> <value> [--<param> <value> ...]
```

Example — create a flow:
```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts create flow --name "My Flow" --projectId proj-123
```

3. Check the output:
   - **Exit code 0** — success. The JSON output contains the created resource including its new `_id`. Capture the `_id` if this is part of a composite workflow.
   - **Exit code 2** — `.env` found via git walk. Show the path, ask for confirmation, re-run with `--env-path <path>` if confirmed.
   - **Exit code 1** — show the `error` field to the user.

## Notes

- `projectId` can be omitted if `COGNIGY_PROJECT_ID` is set in `.env` — the CLI will use it as the default.
- Pass `--projectId` to override the `.env` default for a specific call.
- Do not invent parameter names — check the resource module's type definitions in `cli/src/resources/` for what each resource accepts.
```

- [ ] **Step 3: Create skills/update/SKILL.md**

```markdown
---
description: Update an existing Cognigy resource by ID
---

# Cognigy Update

Update fields on an existing Cognigy resource.

## When to Use

Use this skill when the user wants to modify an existing resource.

## Steps

1. Identify the resource type, the resource ID, and the fields to update. If the ID is unknown, use the `get` skill first.

2. Run the CLI:

```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts update <resource> <id> --<field> <value> [--<field> <value> ...]
```

Example — rename a flow:
```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts update flow flow-abc --name "Better Name"
```

3. Check the output:
   - **Exit code 0** — success. The JSON output contains the updated resource.
   - **Exit code 2** — `.env` found via git walk. Show the path, ask for confirmation, re-run with `--env-path <path>` if confirmed.
   - **Exit code 1** — show the `error` field to the user.

## Notes

- Only pass the fields you want to change — unspecified fields are left unchanged.
- Update is a PATCH, not a PUT — partial updates are safe.
```

- [ ] **Step 4: Create skills/delete/SKILL.md**

```markdown
---
description: Delete a Cognigy resource by ID
---

# Cognigy Delete

Delete a Cognigy resource. This is irreversible — always confirm with the user before proceeding.

## When to Use

Use this skill when the user explicitly asks to delete a resource.

## Steps

1. Identify the resource type and ID. If the ID is unknown, use the `get` skill first.

2. **Always confirm before deleting.** Ask: *"Are you sure you want to delete `<resource>` `<id>`? This cannot be undone."* Do not proceed until the user confirms.

3. Run the CLI:

```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts delete <resource> <id>
```

4. Check the output:
   - **Exit code 0** — success. Output will be `{ "deleted": true, "resource": "...", "id": "..." }`.
   - **Exit code 2** — `.env` found via git walk. Show the path, ask for confirmation, re-run with `--env-path <path>` if confirmed.
   - **Exit code 1** — show the `error` field to the user.

## Notes

- Deletion is permanent. Do not skip the confirmation step, even in automated workflows.
```

- [ ] **Step 5: Commit**

```bash
git add skills/
git commit -m "feat: add atomic CRUD skills (get, create, update, delete)"
```

---

## Task 11: End-to-end smoke test

This task validates both architectural questions from the spec.

**Prerequisite:** A real Cognigy environment with a valid `.env` in your test project directory.

- [ ] **Step 1: Run init in a test directory**

```bash
mkdir /tmp/cognigy-test && cd /tmp/cognigy-test
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts init
```

Expected output:
```json
{
  "message": ".env created",
  "path": "/tmp/cognigy-test/.env"
}
```

- [ ] **Step 2: Fill in the .env**

```bash
# Edit /tmp/cognigy-test/.env and set:
# COGNIGY_BASE_URL=https://your-env.cognigy.ai
# COGNIGY_API_TOKEN=your-token
# COGNIGY_PROJECT_ID=your-project-id
```

- [ ] **Step 3: Get a flow (validates CLI + env + flows module end-to-end)**

```bash
cd /tmp/cognigy-test
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts get flow <a-real-flow-id>
```

Expected: JSON output with flow data. Exit code 0.

- [ ] **Step 4: Validate Q1 — does the skill work generically?**

In Claude Code, with `/tmp/cognigy-test` as your working directory, invoke the `get` skill and ask for a flow by ID. Observe:
- Does the skill invoke the CLI correctly?
- Does Claude parse and present the JSON output?
- Does the `requiresConfirmation` path work if you move the `.env` to a parent directory?

- [ ] **Step 5: Record findings**

Document what broke (if anything) and where:
- Broke in the skill → skill needs resource-awareness
- Broke in CLI routing → fix in `index.ts`
- Broke in flows.ts → fix in the resource module

This is the learning from the validation experiment. Update this plan or open follow-up tasks accordingly.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: complete first milestone — CLI shell + flows + atomic skills"
```

---

## Deferred: Composite skill (create-ai-agent)

`skills/create-ai-agent/SKILL.md` was scoped in the design but is deferred from this plan. A composite skill that chains `create flow` → `create ai-agent` → `create tool × N` requires at least an `ai-agents.ts` and `tools.ts` resource module to exist first.

Once those modules are generated (via the meta-skill or hand-written), write the composite skill as an ordered sequence of atomic CLI invocations with explicit context-passing between steps (capture `_id` from each result and pass as `--parentId` to the next).
