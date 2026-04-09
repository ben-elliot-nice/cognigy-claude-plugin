# Projects Resource Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `project` resource module to the cognigy-claude-plugin CLI so users can list, get, create, update, and delete Cognigy projects.

**Architecture:** Mirror the existing `flows.ts` pattern — a `ResourceHandlers` object exported from `cli/src/resources/projects.ts`, tested in a sibling `.test.ts` file, wired into `cli/src/index.ts` registry under the `project` key. Unlike `flows`, projects are the top-level entity so no `projectId` scoping is needed on `list` or `create`.

**Tech Stack:** TypeScript, Vitest, `npx tsx` for CLI execution

---

## File Map

| Action | File |
|---|---|
| Create | `cli/src/resources/projects.ts` |
| Create | `cli/src/resources/projects.test.ts` |
| Modify | `cli/src/index.ts` (import + registry entry) |

---

### Task 1: Write the failing tests

**Files:**
- Create: `cli/src/resources/projects.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// cli/src/resources/projects.test.ts
import { describe, it, expect, vi } from 'vitest'
import { projects } from './projects.js'
import type { CognigyClient, EnvConfig } from '../lib/types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
  projectId: 'proj-123',
}

const mockProject = {
  _id: 'proj-abc',
  name: 'Test Project',
}

function makeClient(overrides: Partial<CognigyClient> = {}): CognigyClient {
  return {
    get: vi.fn().mockResolvedValue(mockProject),
    post: vi.fn().mockResolvedValue(mockProject),
    patch: vi.fn().mockResolvedValue(mockProject),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('projects.list', () => {
  it('calls GET /projects', async () => {
    const client = makeClient()
    await projects.list!(client, env)
    expect(client.get).toHaveBeenCalledWith('/projects')
  })
})

describe('projects.get', () => {
  it('calls GET /projects/:id', async () => {
    const client = makeClient()
    await projects.get!('proj-abc', client, env)
    expect(client.get).toHaveBeenCalledWith('/projects/proj-abc')
  })
})

describe('projects.create', () => {
  it('calls POST /projects with name', async () => {
    const client = makeClient()
    await projects.create!({ name: 'New Project' }, client, env)
    expect(client.post).toHaveBeenCalledWith('/projects', { name: 'New Project' })
  })

  it('passes all supported fields', async () => {
    const client = makeClient()
    await projects.create!({ name: 'New Project', color: 'red' }, client, env)
    expect(client.post).toHaveBeenCalledWith('/projects', { name: 'New Project', color: 'red' })
  })
})

describe('projects.update', () => {
  it('calls PATCH /projects/:id with update params', async () => {
    const client = makeClient()
    await projects.update!('proj-abc', { name: 'Renamed' }, client, env)
    expect(client.patch).toHaveBeenCalledWith('/projects/proj-abc', { name: 'Renamed' })
  })
})

describe('projects.delete', () => {
  it('calls DELETE /projects/:id', async () => {
    const client = makeClient()
    await projects.delete!('proj-abc', client, env)
    expect(client.delete).toHaveBeenCalledWith('/projects/proj-abc')
  })
})
```

- [ ] **Step 2: Run tests to confirm RED (import will fail, that's expected)**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test -- --reporter=verbose 2>&1 | head -40
```

Expected: error like `Cannot find module './projects.js'`

---

### Task 2: Write the implementation module

**Files:**
- Create: `cli/src/resources/projects.ts`

- [ ] **Step 1: Write the module**

```typescript
// cli/src/resources/projects.ts
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

export interface Project {
  _id: string
  name: string
  color?: string
  locale?: string
}

export const projects: ResourceHandlers = {
  async list(client) {
    return client.get<Project[]>('/projects')
  },

  async get(id, client) {
    return client.get<Project>(`/projects/${id}`)
  },

  async create(params, client) {
    return client.post<Project>('/projects', params)
  },

  async update(id, params, client) {
    return client.patch<Project>(`/projects/${id}`, params)
  },

  async delete(id, client) {
    return client.delete(`/projects/${id}`)
  },
}
```

- [ ] **Step 2: Run tests to confirm GREEN**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all 5 `projects.*` tests pass, all existing `flows.*` tests still pass.

- [ ] **Step 3: Commit**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/resources/projects.ts cli/src/resources/projects.test.ts
git commit -m "feat: add projects resource module (list/get/create/update/delete)"
```

---

### Task 3: Wire into CLI registry

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Add import and registry entry**

In `cli/src/index.ts`, after the existing `import { flows } ...` line add:

```typescript
import { projects } from './resources/projects.js'
```

And in the `registry` object, add `project: projects`:

```typescript
const registry: ResourceRegistry = {
  flow: flows,
  project: projects,
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test -- --reporter=verbose
```

Expected: all tests pass (flows + projects).

- [ ] **Step 3: Smoke test the CLI**

```bash
npx tsx ~/repos/claude-marketplace/cognigy-claude-plugin/cli/src/index.ts list project --env-path /Users/Ben.Elliot/repos/cognigy-nexora/market/.env
```

Expected: JSON array of projects.

- [ ] **Step 4: Commit and push**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/index.ts
git commit -m "feat: wire project resource into CLI registry"
git push
```
