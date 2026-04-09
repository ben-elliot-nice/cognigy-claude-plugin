# Handler Contract Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `ResourceHandlers` to support scoped sub-resources (via `params` + `requires`) and named non-CRUD operations (via `operations` + `invoke` verb).

**Architecture:** Three targeted additions to the existing contract: (1) pass parsed flags as `params` to `list`/`get`/`delete` handlers so sub-resources can read parent IDs; (2) a `requires` field on handlers that the CLI validates before dispatch; (3) an `operations` map on handlers and a new `invoke` CLI verb to dispatch named actions. Backward compatible — existing handlers that don't use `params` simply ignore the extra argument.

**Tech Stack:** TypeScript, Node.js, vitest (test runner), `npx tsx` to run CLI

---

## Background: What this fixes

### The charts problem (before this plan)

`charts.ts` currently misuses the `get` positional ID as the `flowId`:

```
cognigy get chart <flowId>   ← ID slot is actually the parent flowId
```

After this plan:

```
cognigy get chart --flowId <id>   ← parent ID is a flag; requires validates it first
```

### The invoke problem

`clone`, `train`, `restore`, and similar actions are not CRUD. Forcing them into `create` is semantically wrong. After this plan:

```
cognigy invoke flow <id> --op clone
cognigy invoke snapshot <id> --op restore
```

---

## File Map

| File | Change |
|---|---|
| `cli/src/lib/types.ts` | Add `params` to `list`/`get`/`delete` signatures; add `requires?`, `OperationHandler`, `operations?` |
| `cli/src/index.ts` | Pass `flags` to `list`/`get`/`delete`; add `validateRequires`; fix `get` id check; add `invoke` case |
| `cli/src/resources/charts.ts` | Add `requires: ['flowId']`; update `get` to read `flowId` from `params` not `id` |
| `cli/src/resources/charts.test.ts` | Replace test to pass `params`; add fallback and missing-flowId tests |
| `cli/src/resources/flows.ts` | Add `operations.clone` |
| `cli/src/resources/flows.test.ts` | Add test for `operations.clone` |
| `skills/invoke/SKILL.md` | New skill file for the `invoke` verb |

---

## Task 1: Extend ResourceHandlers type

**Files:**
- Modify: `cli/src/lib/types.ts`

No test file — TypeScript compilation validates this. All subsequent tasks depend on this being done first.

- [ ] **Step 1: Replace the contents of `cli/src/lib/types.ts`**

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

export type OperationHandler = (
  id: string,
  params: Record<string, string>,
  client: CognigyClient,
  env: EnvConfig
) => Promise<unknown>

export type ResourceHandlers = {
  requires?: string[]
  list?: (client: CognigyClient, env: EnvConfig, params: Record<string, string>) => Promise<unknown>
  get?: (id: string, client: CognigyClient, env: EnvConfig, params: Record<string, string>) => Promise<unknown>
  create?: (params: Record<string, string>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  update?: (id: string, params: Record<string, string>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  delete?: (id: string, client: CognigyClient, env: EnvConfig, params: Record<string, string>) => Promise<void>
  operations?: Record<string, OperationHandler>
}

export type ResourceRegistry = Record<string, ResourceHandlers>

export interface EnvFindResult {
  path: string
  fromWalk: boolean
}
```

- [ ] **Step 2: Verify the existing test suite still passes (TypeScript allows extra args to be ignored)**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: all existing tests pass (flows, projects, charts). TypeScript will compile because handlers with fewer params still satisfy the new type — extra trailing params are ignored.

- [ ] **Step 3: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/lib/types.ts
git commit -m "feat: extend ResourceHandlers type with params, requires, and operations"
```

---

## Task 2: Fix charts resource to use params

**Files:**
- Modify: `cli/src/resources/charts.test.ts`
- Modify: `cli/src/resources/charts.ts`

The current `charts.get` uses the positional `id` argument as the `flowId`. After this task it reads `flowId` from `params` (flags), with a fallback to `env.flowId`.

- [ ] **Step 1: Write failing tests in `cli/src/resources/charts.test.ts`**

Replace the entire file:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { charts } from './charts.js'
import type { CognigyClient, EnvConfig } from '../lib/types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
  projectId: 'proj-123',
}

const mockChart = {
  nodes: [{ _id: 'node-abc', type: 'if', label: 'My Node' }],
  relations: [{ _id: 'rel-abc', node: 'node-abc', children: [], next: null }],
}

function makeClient(overrides: Partial<CognigyClient> = {}): CognigyClient {
  return {
    get: vi.fn().mockResolvedValue(mockChart),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('charts.requires', () => {
  it('declares that flowId is required', () => {
    expect(charts.requires).toEqual(['flowId'])
  })
})

describe('charts.get', () => {
  it('calls GET /flows/:flowId/chart using params.flowId', async () => {
    const client = makeClient()
    await charts.get!('', client, env, { flowId: 'flow-abc' })
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc/chart')
  })

  it('falls back to env.flowId when params.flowId is absent', async () => {
    const client = makeClient()
    const envWithFlow: EnvConfig = { ...env, flowId: 'flow-env' }
    await charts.get!('', client, envWithFlow, {})
    expect(client.get).toHaveBeenCalledWith('/flows/flow-env/chart')
  })

  it('throws when flowId is absent from both params and env', async () => {
    const client = makeClient()
    await expect(charts.get!('', client, env, {})).rejects.toThrow('flowId is required')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: `charts.requires` test FAILS (charts.requires is undefined), `charts.get` tests FAIL (handler uses `id` not `params.flowId`).

- [ ] **Step 3: Update `cli/src/resources/charts.ts`**

Replace the entire file:

```typescript
import type { ResourceHandlers } from '../lib/types.js'

interface ChartNode {
  _id: string
  type?: string
  label?: string
}

interface ChartRelation {
  _id: string
  node: string
  children: string[]
  next?: string | null
}

interface Chart {
  nodes: ChartNode[]
  relations: ChartRelation[]
}

export const charts: ResourceHandlers = {
  requires: ['flowId'],

  async get(_id, client, env, params) {
    const flowId = params['flowId'] ?? env.flowId
    if (!flowId) throw new Error('flowId is required — set COGNIGY_FLOW_ID in .env or pass --flowId')
    return client.get<Chart>(`/flows/${flowId}/chart`)
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: all 3 new chart tests PASS. All existing flow and project tests still PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/resources/charts.ts cli/src/resources/charts.test.ts
git commit -m "fix: charts.get reads flowId from params/env instead of positional id"
```

---

## Task 3: Add clone operation to flows

**Files:**
- Modify: `cli/src/resources/flows.test.ts`
- Modify: `cli/src/resources/flows.ts`

Adding `clone` to the `operations` map validates the pattern before wiring `invoke` into the CLI.

- [ ] **Step 1: Add failing test to `cli/src/resources/flows.test.ts`**

Append to the end of the existing file (do not replace — keep all existing tests):

```typescript
describe('flows.operations.clone', () => {
  it('calls POST /flows/:id/clone with empty body', async () => {
    const client = makeClient()
    await flows.operations!['clone']('flow-abc', {}, client, env)
    expect(client.post).toHaveBeenCalledWith('/flows/flow-abc/clone', {})
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: `flows.operations.clone` FAILS with `Cannot read properties of undefined (reading 'clone')`.

- [ ] **Step 3: Add `operations` to `cli/src/resources/flows.ts`**

The existing file imports `Flow`, `CreateFlowInput`, `UpdateFlowInput` from `flow.types.ts` and exports `flows`. Add `operations` to the `flows` object. Append after the `delete` handler (before the closing `}`):

```typescript
  operations: {
    async clone(id, _params, client) {
      return client.post<Flow>(`/flows/${id}/clone`, {})
    },
  },
```

The full updated `flows.ts`:

```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'
import type { Flow, CreateFlowInput, UpdateFlowInput } from './flow.types.js'
export type { Flow }

function resolveProjectId(params: Record<string, string>, env: EnvConfig): string {
  const id = params['projectId'] ?? env.projectId
  if (!id) throw new Error('projectId is required — set COGNIGY_PROJECT_ID in .env or pass --projectId')
  return id
}

export const flows: ResourceHandlers = {
  async list(client, env) {
    if (!env.projectId) throw new Error('projectId is required — set COGNIGY_PROJECT_ID in .env')
    return client.get<Flow[]>(`/flows?projectId=${env.projectId}`)
  },

  async get(id, client) {
    return client.get<Flow>(`/flows/${id}`)
  },

  async create(params, client, env) {
    const projectId = resolveProjectId(params, env)
    const { projectId: _omit, ...rest } = params
    return client.post<Flow>('/flows', { ...rest, projectId })
  },

  async update(id, params, client) {
    return client.patch<Flow>(`/flows/${id}`, params)
  },

  async delete(id, client) {
    return client.delete(`/flows/${id}`)
  },

  operations: {
    async clone(id, _params, client) {
      return client.post<Flow>(`/flows/${id}/clone`, {})
    },
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: all tests PASS including the new `flows.operations.clone` test.

- [ ] **Step 5: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/resources/flows.ts cli/src/resources/flows.test.ts
git commit -m "feat: add clone operation to flows resource handler"
```

---

## Task 4: Update CLI dispatcher — params + requires validation

**Files:**
- Modify: `cli/src/index.ts`

No unit tests for `index.ts` (it's the CLI entry point). Correctness is verified by the handler unit tests + a manual smoke test at the end.

This task: (1) add `validateRequires` helper; (2) pass `flags` to `list`/`get`/`delete`; (3) fix `get` to not require a positional ID when the handler declares `requires`.

- [ ] **Step 1: Replace `cli/src/index.ts` with the updated version**

```typescript
#!/usr/bin/env node
import { findEnvFile, loadEnv } from './lib/env.js'
import { createClient } from './lib/client.js'
import type { ResourceHandlers, ResourceRegistry } from './lib/types.js'
import { flows } from './resources/flows.js'
import { projects } from './resources/projects.js'
import { charts } from './resources/charts.js'

// Resource registry — add new modules here as they're generated
const registry: ResourceRegistry = {
  flow: flows,
  project: projects,
  chart: charts,
}

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

function toEnvVarName(camelKey: string): string {
  return 'COGNIGY_' + camelKey.replace(/([A-Z])/g, '_$1').toUpperCase()
}

function validateRequires(resource: string, handlers: ResourceHandlers, flags: Record<string, string>, env: Record<string, string | undefined>): void {
  for (const key of (handlers.requires ?? [])) {
    if (!flags[key] && !env[key]) {
      fail(`'${resource}' requires --${key} or ${toEnvVarName(key)} to be set`)
    }
  }
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
      output({ requiresConfirmation: true, path: found.path })
      process.exit(2)
    }
    envPath = found.path
  }

  const env = loadEnv(envPath)
  const client = createClient(env)

  // Accept plural resource names (e.g. "projects" → "project")
  const resolvedResource = registry[resource] ? resource : resource.replace(/s$/, '')
  const handlers = registry[resolvedResource]
  if (!handlers) {
    fail(`Unknown resource: "${resource}". Available: ${Object.keys(registry).join(', ') || 'none registered yet'}`)
  }

  // Validate required parent IDs before dispatch
  validateRequires(resolvedResource, handlers, flags, env as unknown as Record<string, string | undefined>)

  // Determine if thirdArg is an ID (not a flag)
  const id = thirdArg && !thirdArg.startsWith('--') ? thirdArg : undefined

  switch (verb) {
    case 'list': {
      if (!handlers.list) fail(`Resource "${resource}" does not support list`)
      output(await handlers.list(client, env, flags))
      break
    }
    case 'get': {
      // Resources with `requires` use params for identification — no positional ID needed
      if (!handlers.requires?.length && !id) fail(`get requires an ID: cognigy get ${resource} <id>`)
      if (!handlers.get) fail(`Resource "${resource}" does not support get`)
      output(await handlers.get(id ?? '', client, env, flags))
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
      await handlers.delete(id, client, env, flags)
      output({ deleted: true, resource: resolvedResource, id })
      break
    }
    case 'invoke': {
      if (!id) fail(`invoke requires an ID: cognigy invoke ${resource} <id> --op <operation>`)
      const op = flags['op']
      if (!op) fail(`invoke requires --op <operation>: cognigy invoke ${resource} <id> --op <operation>`)
      delete flags['op']  // don't forward meta-flag to operation handler
      if (!handlers.operations) fail(`Resource "${resource}" has no operations`)
      const handler = handlers.operations[op]
      if (!handler) {
        const available = Object.keys(handlers.operations).join(', ')
        fail(`Resource "${resource}" has no operation "${op}". Available: ${available}`)
      }
      output(await handler(id, flags, client, env))
      break
    }
    default:
      fail(`Unknown verb: "${verb}". Valid verbs: list, get, create, update, delete, invoke`)
  }
}

main().catch(err => {
  console.error(JSON.stringify({ error: (err as Error).message }))
  process.exit(1)
})
```

- [ ] **Step 2: Run the test suite to confirm nothing regressed**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/index.ts
git commit -m "feat: pass params to list/get/delete, add requires validation, add invoke verb"
```

---

## Task 5: Add invoke skill

**Files:**
- Create: `skills/invoke/SKILL.md`

- [ ] **Step 1: Create `skills/invoke/SKILL.md`**

```markdown
---
name: invoke
description: Invoke a named operation on a Cognigy resource (e.g. clone, train, restore)
---

# Cognigy Invoke

Run a named operation on a Cognigy resource. Operations are non-CRUD actions — clone, train, restore, trigger, etc.

## When to Use

Use this skill when the user wants to perform an action on an existing resource that isn't a standard read/write:
- "Clone flow X"
- "Restore snapshot Y"
- "Train the NLU model"
- "Trigger function Z"

## Finding the CLI

When Claude Code loads this skill, it injects `Base directory for this skill: <path>` into context. That path ends in `skills/invoke`. Go two directories up to get the plugin root. The CLI entry point is `<plugin-root>/cli/src/index.ts`.

## Steps

1. Identify the resource type, the resource ID, and the operation name.
   - If the ID is unknown, use the `list` skill first.
   - If the operation name is unknown, check the resource handler's `operations` map in `<plugin-root>/cli/src/resources/<resource>.ts`.

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI:
```bash
npx tsx <plugin-root>/cli/src/index.ts invoke <resource> <id> --op <operation>
```

3. Check the result:
   - **Exit 0** — success. Parse and present the JSON to the user.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.
     - `No .env file found` → invoke the `cognigy:init` skill to set up the connection, then retry
     - `has no operation` → the operation is not implemented. Check the resource handler or tell the user it is not yet supported.
     - `Unknown resource` → invoke `/private:cognigy-generate-resource` to add support, then retry. If that skill is not installed, stop and tell the user the resource is not yet supported.
     - `API error 401` → token invalid or expired

## Notes

- `invoke` always requires a resource ID and `--op <name>`.
- Additional flags (e.g. `--targetProjectId`) are forwarded to the operation handler as `params`.
- To see what operations a resource supports, read its handler file: `cli/src/resources/<resource>.ts` and look for the `operations` key.
```

- [ ] **Step 2: Run the test suite one final time to confirm everything is clean**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git add skills/invoke/SKILL.md
git commit -m "feat: add invoke skill for named resource operations"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Add `params` to `list`/`get`/`delete` handler signatures | Task 1 (types), Task 4 (dispatch) |
| Add `requires?: string[]` to `ResourceHandlers` | Task 1 (types), Task 4 (validation) |
| CLI validates `requires` before dispatch | Task 4 |
| Add `OperationHandler` type and `operations` map | Task 1 |
| Add `invoke` verb to CLI | Task 4 |
| Fix `charts.ts` to use params instead of misusing `id` | Task 2 |
| Charts: validate `flowId` present, fall back to `env.flowId` | Task 2 |
| Add concrete `operations.clone` to flows as pattern validation | Task 3 |
| Skill for `invoke` verb | Task 5 |
| Backward compatible (existing handlers unchanged) | Task 1 (TypeScript trailing params) |

**Placeholder scan:** No TBDs, no "implement later", no "similar to" references. All code blocks are complete.

**Type consistency:**
- `OperationHandler` defined in Task 1, used in Task 3 (`flows.operations.clone` satisfies the shape) and Task 4 (`handler(id, flags, client, env)` matches `(id, params, client, env)`)
- `handlers.requires` accessed as `string[]` in Task 4 — consistent with `requires?: string[]` in Task 1
- `charts.get(_id, client, env, params)` — 4-arg signature matches extended `get` type in Task 1
