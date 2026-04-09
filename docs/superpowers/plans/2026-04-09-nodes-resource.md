# Nodes Resource Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `nodes` CLI resource module for Cognigy flow nodes, enabling `list`, `get`, `create`, `update`, `delete`, and `move` via the cognigy-claude-plugin CLI.

**Architecture:** Nodes are a sub-resource of flows, living at `/flows/{flowId}/chart/nodes[/{nodeId}]`. The module declares `requires: ['flowId']` and resolves `flowId` from `params['flowId'] ?? env.flowId`. All paths are handled via the existing `CognigyClient` which prepends `/v2.0` automatically.

**Tech Stack:** TypeScript, Vitest, cognigy-claude-plugin CLI framework

---

## Files

| File | Action | Purpose |
|---|---|---|
| `cli/src/resources/node.types.ts` | Already exists | Types generated from OpenAPI spec |
| `cli/src/resources/nodes.test.ts` | Already exists (RED) | Test suite — needs module to pass |
| `cli/src/resources/nodes.ts` | **Create** | Resource module implementing all handlers |
| `cli/src/index.ts` | **Modify** | Wire `node: nodes` into the registry |

---

### Task 1: Run the existing tests to confirm RED

- [ ] **Step 1: Run the nodes tests**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test -- nodes
```

Expected: All tests FAIL with `Cannot find module './nodes.js'` or similar.

---

### Task 2: Write the `nodes.ts` module

- [ ] **Step 1: Create `cli/src/resources/nodes.ts`**

```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'
import type { Node, CreateNodeInput, UpdateNodeInput } from './node.types.js'
export type { Node }

function resolveFlowId(params: Record<string, string>, env: EnvConfig): string {
  const id = params['flowId'] ?? env.flowId
  if (!id) throw new Error('flowId is required — set COGNIGY_FLOW_ID in .env or pass --flowId')
  return id
}

export const nodes: ResourceHandlers = {
  requires: ['flowId'],

  async list(client, env, params) {
    const flowId = resolveFlowId(params, env)
    return client.get<Node[]>(`/flows/${flowId}/chart/nodes`)
  },

  async get(id, client, env, params) {
    const flowId = resolveFlowId(params, env)
    return client.get<Node>(`/flows/${flowId}/chart/nodes/${id}`)
  },

  async create(params, client, env) {
    const flowId = resolveFlowId(params, env)
    const { flowId: _omit, ...rest } = params
    return client.post<Node>(`/flows/${flowId}/chart/nodes`, rest)
  },

  async update(id, params, client, env) {
    const flowId = resolveFlowId(params, env)
    const { flowId: _omit, ...rest } = params
    return client.patch<Node>(`/flows/${flowId}/chart/nodes/${id}`, rest)
  },

  async delete(id, client, env, params) {
    const flowId = resolveFlowId(params, env)
    return client.delete(`/flows/${flowId}/chart/nodes/${id}`)
  },

  operations: {
    async move(id, params, client, env) {
      const flowId = resolveFlowId(params, env)
      const { flowId: _omit, ...rest } = params
      return client.post(`/flows/${flowId}/chart/nodes/${id}/move`, rest)
    },
  },
}
```

---

### Task 3: Run tests — confirm GREEN

- [ ] **Step 1: Run the nodes tests**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test -- nodes
```

Expected: All 11 tests PASS.

- [ ] **Step 2: If any test fails, diagnose before proceeding**

Do not continue to Task 4 until all nodes tests pass.

---

### Task 4: Wire into the CLI registry

- [ ] **Step 1: Edit `cli/src/index.ts`**

Add import after the `charts` import:
```typescript
import { nodes } from './resources/nodes.js'
```

Add to the registry object:
```typescript
const registry: ResourceRegistry = {
  flow: flows,
  project: projects,
  chart: charts,
  node: nodes,
}
```

---

### Task 5: Run all tests — confirm nothing broke

- [ ] **Step 1: Run full test suite**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli && npm test
```

Expected: All tests pass including the new nodes suite.

---

### Task 6: Verify and commit

- [ ] **Step 1: Invoke verification skill**

Use `superpowers:verification-before-completion` — confirm all tests pass before committing.

- [ ] **Step 2: Stage files**

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin
git add cli/src/resources/nodes.ts \
        cli/src/resources/node.types.ts \
        cli/src/resources/nodes.test.ts \
        cli/src/index.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add nodes resource module with list/get/create/update/delete/move"
```

- [ ] **Step 4: Push**

```bash
source ~/.zshrc 2>/dev/null
git push
```
