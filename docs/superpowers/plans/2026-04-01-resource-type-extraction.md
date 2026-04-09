# Resource Type Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a script that extracts full TypeScript interfaces for a Cognigy resource (response shape + create/update inputs) from the bundled OpenAPI spec, eliminating hand-written incomplete types and token-burning re-extraction on every agent invocation.

**Architecture:** A single `tsx` script reads `cognigy.json`, locates the three relevant operations for a named resource (GET by ID, POST collection, PATCH record), resolves schemas recursively, and emits a co-located `<resource>.types.ts` file with three named interfaces. Existing resource modules drop their inline interfaces and import from the generated file. The meta-skill is updated to run the script as step 1.5 of resource generation.

**Tech Stack:** Node.js built-ins only (`fs`, `path`), `tsx` (already in devDependencies), ESM (`import.meta.dirname`).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `cli/scripts/extract-resource-types.ts` | Type extraction script |
| Create | `cli/src/resources/flow.types.ts` | Generated types for flows |
| Create | `cli/src/resources/project.types.ts` | Generated types for projects |
| Modify | `cli/src/resources/flows.ts` | Import from `flow.types.ts`, remove inline interface |
| Modify | `cli/src/resources/projects.ts` | Import from `project.types.ts`, remove inline interface |
| Modify | `cli-private-skills/cognigy-generate-resource/SKILL.md` | Add step 1.5, update step 2, update git add |

---

### Task 1: Write the extraction script

**Files:**
- Create: `cli/scripts/extract-resource-types.ts`

The script takes a resource name (e.g. `flow`, `project`), finds the three relevant OpenAPI paths, converts schemas to TypeScript interfaces, and writes `cli/src/resources/<resource>.types.ts`.

Key spec facts that shape implementation:
- All schemas in path objects are fully inline — `$ref` rarely appears, but build the resolver defensively
- `oneOf` appears in two forms: pure-enum unions (collapse to string union) and complex object variants (emit `unknown // TODO: oneOf`)
- `nullable: true` appears alongside `type: string` — append `| null`
- `required` arrays are often absent — default to optional

- [ ] **Step 1: Create the scripts directory and write the script**

Create `cli/scripts/extract-resource-types.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * Extracts TypeScript interfaces for a Cognigy resource from the bundled OpenAPI spec.
 * Usage: npx tsx scripts/extract-resource-types.ts <resource>
 * Example: npx tsx scripts/extract-resource-types.ts flow
 * Output: cli/src/resources/<resource>.types.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Args ──────────────────────────────────────────────────────────────────────

const resourceName = process.argv[2]
if (!resourceName || resourceName.includes('/') || resourceName.includes('.')) {
  console.error('Usage: npx tsx scripts/extract-resource-types.ts <resource>')
  console.error('Example: npx tsx scripts/extract-resource-types.ts flow')
  process.exit(1)
}

const Resource = resourceName.charAt(0).toUpperCase() + resourceName.slice(1)

// ── Load spec ─────────────────────────────────────────────────────────────────

const specPath = resolve(__dirname, '../openapi/cognigy.json')
const spec: any = JSON.parse(readFileSync(specPath, 'utf8'))

// ── Path discovery ────────────────────────────────────────────────────────────

interface FoundPaths {
  collectionPath: string  // e.g. /v2.0/flows
  recordPath: string      // e.g. /v2.0/flows/{flowId}
}

function findPaths(resourceName: string): FoundPaths {
  const allPaths = Object.keys(spec.paths)

  // Collection path: /v2.0/<something> where <something> contains resourceName (case-insensitive)
  const collectionCandidates = allPaths.filter(p => {
    const match = p.match(/^\/v2\.0\/([^/]+)$/)
    return match && match[1].toLowerCase().includes(resourceName.toLowerCase())
  })

  if (collectionCandidates.length === 0) {
    console.error(`No collection path found for resource "${resourceName}". Check the resource name.`)
    process.exit(1)
  }
  if (collectionCandidates.length > 1) {
    console.error(`Multiple collection paths found for "${resourceName}": ${collectionCandidates.join(', ')}`)
    console.error('Be more specific with the resource name.')
    process.exit(1)
  }

  const collectionPath = collectionCandidates[0]

  // Record path: collectionPath + /{someId}
  const recordCandidates = allPaths.filter(p =>
    p.startsWith(collectionPath + '/') &&
    p.slice(collectionPath.length + 1).match(/^\{[^/]+\}$/)
  )

  if (recordCandidates.length === 0) {
    console.error(`No record path found for collection "${collectionPath}".`)
    process.exit(1)
  }

  return { collectionPath, recordPath: recordCandidates[0] }
}

// ── $ref resolution ───────────────────────────────────────────────────────────

function resolveRef(schema: any, visited = new Set<string>()): any {
  if (!schema || !schema.$ref) return schema
  const ref: string = schema.$ref
  if (visited.has(ref)) return { type: 'object' } // cycle guard
  visited.add(ref)
  const parts = ref.replace('#/', '').split('/')
  const resolved = parts.reduce((obj: any, key) => obj?.[key], spec)
  return resolveRef(resolved, visited)
}

// ── Schema extraction ─────────────────────────────────────────────────────────

function extractSchema(path: string, method: string, location: 'response' | 'requestBody'): any | null {
  const op = spec.paths[path]?.[method]
  if (!op) return null
  if (location === 'response') {
    return op.responses?.['200']?.content?.['application/json']?.schema ?? null
  }
  return op.requestBody?.content?.['application/json']?.schema ?? null
}

// ── Type inference ────────────────────────────────────────────────────────────

function isPureEnumOneOf(variants: any[]): boolean {
  return variants.every((v: any) => {
    const keys = Object.keys(v).filter(k => !['description', 'example'].includes(k))
    return keys.every(k => ['enum', 'type'].includes(k)) && Array.isArray(v.enum)
  })
}

function inferType(schema: any, indent: string): string {
  const resolved = resolveRef(schema)
  if (!resolved) return 'unknown'

  // oneOf
  if (resolved.oneOf) {
    if (isPureEnumOneOf(resolved.oneOf)) {
      const values = resolved.oneOf.flatMap((v: any) => v.enum as string[])
      const deduped = [...new Set(values)]
      return deduped.map(v => JSON.stringify(v)).join(' | ')
    }
    return 'unknown // TODO: oneOf — see OpenAPI spec'
  }

  // anyOf
  if (resolved.anyOf) return 'unknown // TODO: anyOf — see OpenAPI spec'

  // allOf — merge all variant properties
  if (resolved.allOf) {
    const merged: any = { type: 'object', properties: {}, required: [] }
    for (const s of resolved.allOf) {
      const r = resolveRef(s)
      if (r?.properties) Object.assign(merged.properties, r.properties)
      if (r?.required) merged.required.push(...r.required)
    }
    return inferType(merged, indent)
  }

  // enum on a scalar type
  if (resolved.enum) {
    return (resolved.enum as any[]).map(v => JSON.stringify(v)).join(' | ')
  }

  // array
  if (resolved.type === 'array') {
    const itemType = resolved.items ? inferType(resolved.items, indent) : 'unknown'
    return `${itemType}[]`
  }

  // object
  if (resolved.type === 'object' || resolved.properties) {
    if (!resolved.properties || Object.keys(resolved.properties).length === 0) {
      return 'Record<string, unknown>'
    }
    const required: string[] = resolved.required ?? []
    const childIndent = indent + '  '
    const lines = Object.entries(resolved.properties).map(([key, val]) => {
      const optional = required.includes(key) ? '' : '?'
      const type = inferType(val as any, childIndent)
      const nullable = (val as any).nullable ? ' | null' : ''
      return `${childIndent}${key}${optional}: ${type}${nullable}`
    })
    return `{\n${lines.join('\n')}\n${indent}}`
  }

  // scalars
  const nullable = resolved.nullable ? ' | null' : ''
  switch (resolved.type) {
    case 'string':  return `string${nullable}`
    case 'number':
    case 'integer': return `number${nullable}`
    case 'boolean': return `boolean${nullable}`
    default:        return `unknown${nullable}`
  }
}

// ── Interface generation ──────────────────────────────────────────────────────

function generateInterface(name: string, schema: any, allOptional: boolean): string {
  const resolved = resolveRef(schema)
  if (!resolved || (resolved.type !== 'object' && !resolved.properties)) {
    return `export interface ${name} {\n  // Schema not available or not an object type\n}`
  }
  const required: string[] = allOptional ? [] : (resolved.required ?? [])
  const props = Object.entries(resolved.properties ?? {}).map(([key, val]) => {
    const optional = required.includes(key) ? '' : '?'
    const type = inferType(val as any, '  ')
    const nullable = (val as any).nullable ? ' | null' : ''
    return `  ${key}${optional}: ${type}${nullable}`
  })
  return `export interface ${name} {\n${props.join('\n')}\n}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { collectionPath, recordPath } = findPaths(resourceName)

const getSchema    = extractSchema(recordPath, 'get', 'response')
const postSchema   = extractSchema(collectionPath, 'post', 'requestBody')
const patchSchema  = extractSchema(recordPath, 'patch', 'requestBody')

const sections: string[] = [
  `// Generated from Cognigy OpenAPI spec`,
  `// Run: npx tsx scripts/extract-resource-types.ts ${resourceName}`,
  `// Do not edit manually — re-run the script to regenerate`,
  ``,
]

if (getSchema) {
  sections.push(generateInterface(Resource, getSchema, false))
  sections.push('')
} else {
  sections.push(`// ${Resource}: GET response schema not found in spec`)
  sections.push('')
}

if (postSchema) {
  sections.push(generateInterface(`Create${Resource}Input`, postSchema, false))
  sections.push('')
} else {
  sections.push(`export interface Create${Resource}Input {\n  // Not supported by this resource\n}`)
  sections.push('')
}

if (patchSchema) {
  sections.push(generateInterface(`Update${Resource}Input`, patchSchema, true))
  sections.push('')
} else {
  sections.push(`export interface Update${Resource}Input {\n  // Not supported by this resource\n}`)
  sections.push('')
}

const output = sections.join('\n')
const outPath = resolve(__dirname, `../src/resources/${resourceName}.types.ts`)
writeFileSync(outPath, output, 'utf8')

console.log(`Written: ${outPath}`)
console.log('')
console.log(output)
```

- [ ] **Step 2: Run the script for `flow` and verify output**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli
npx tsx scripts/extract-resource-types.ts flow
```

Expected: `Written: .../cli/src/resources/flow.types.ts` followed by the interface output. Inspect the generated file — check that `Flow` has realistic fields (`_id`, `name`, `projectId`, etc.), `CreateFlowInput` has `name` and `projectId`, `UpdateFlowInput` has all fields optional.

If the script exits with an error, fix before proceeding.

- [ ] **Step 3: Run the script for `project` and verify output**

```bash
npx tsx scripts/extract-resource-types.ts project
```

Expected: `Written: .../cli/src/resources/project.types.ts`. Inspect — `Project` should be more complete than the current hand-written interface (which only had `_id`, `name`, `color?`, `locale?`).

- [ ] **Step 4: Commit the script and generated types**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
source ~/.zshrc 2>/dev/null
git add cli/scripts/extract-resource-types.ts cli/src/resources/flow.types.ts cli/src/resources/project.types.ts
git commit -m "feat: add extract-resource-types script, generate flow and project types"
```

---

### Task 2: Update `flows.ts` to import from generated types

**Files:**
- Modify: `cli/src/resources/flows.ts`

Remove the inline `Flow` interface and import it from `flow.types.ts`. Also import `CreateFlowInput` and `UpdateFlowInput` — they serve as documentation even though the handler signatures stay `Record<string, string>`.

- [ ] **Step 1: Run tests before touching anything**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli
npm test
```

Expected: 21 tests pass. Baseline confirmed.

- [ ] **Step 2: Update `flows.ts`**

Replace:
```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

export interface Flow {
  _id: string
  name: string
  description?: string
  projectId: string
  isTrainingOutOfDate?: boolean
  createdAt?: string
  updatedAt?: string
}
```

With:
```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'
import type { Flow, CreateFlowInput, UpdateFlowInput } from './flow.types.js'
export type { Flow }
```

No other changes to the file — the `client.get<Flow>(...)` references stay as-is.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 21 tests pass. If any fail, a type import path is wrong — check the `.js` extension on the import.

- [ ] **Step 4: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
source ~/.zshrc 2>/dev/null
git add cli/src/resources/flows.ts
git commit -m "refactor: flows.ts imports types from generated flow.types.ts"
```

---

### Task 3: Update `projects.ts` to import from generated types

**Files:**
- Modify: `cli/src/resources/projects.ts`

Same pattern as Task 2.

- [ ] **Step 1: Update `projects.ts`**

Replace:
```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

export interface Project {
  _id: string
  name: string
  color?: string
  locale?: string
}
```

With:
```typescript
import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'
import type { Project, CreateProjectInput, UpdateProjectInput } from './project.types.js'
export type { Project }
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin/cli
npm test
```

Expected: 21 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
source ~/.zshrc 2>/dev/null
git add cli/src/resources/projects.ts
git commit -m "refactor: projects.ts imports types from generated project.types.ts"
```

---

### Task 4: Update the meta-skill

**Files:**
- Modify: `/Users/Ben.Elliot/repos/claude-marketplace/claude-private-skills/skills/cognigy-generate-resource/SKILL.md`

- [ ] **Step 1: Add step 1.5 and update affected sections**

Make the following changes to `SKILL.md`:

**a) Add to the `Reference Files` section:**
```
- `cli/scripts/extract-resource-types.ts` — run this first to generate `<resource>.types.ts`; import from it rather than writing inline interfaces.
```

**b) Insert new step 1.5 between steps 1 and 2:**
```markdown
### 1.5. Generate the types file

```bash
cd ~/repos/claude-marketplace/cognigy-claude-plugin/cli
npx tsx scripts/extract-resource-types.ts <resource>
```

This writes `cli/src/resources/<resource>.types.ts` containing three interfaces:
- `<Resource>` — full response shape from GET by ID
- `Create<Resource>Input` — POST request body fields
- `Update<Resource>Input` — PATCH request body fields (all optional)

Inspect the output. Fields marked `// TODO: oneOf` or `// TODO: anyOf` were too complex to type automatically — review them against the spec if they matter for the handlers you're writing.
```

**c) Replace the module contract / interface guidance in Step 2:**

Remove: *"Define a TypeScript interface for the resource shape. When the spec marks no fields as `required`, use a minimal interface covering `_id`, `name`, and the most important fields — don't attempt to type the full nested schema. See `flows.ts` for the pattern."*

Replace with:
```
Import your types from the generated `.types.ts` file rather than defining inline interfaces:

```typescript
import type { <Resource>, Create<Resource>Input, Update<Resource>Input } from './<resource>.types.js'
export type { <Resource> }
```
```

**d) Update Step 7 git add to include the types file:**
```bash
git add cli/scripts/extract-resource-types.ts \
        cli/src/resources/<resource>.ts \
        cli/src/resources/<resource>.types.ts \
        cli/src/resources/<resource>.test.ts \
        cli/src/index.ts
```
(Note: `extract-resource-types.ts` only needs adding once — omit it after first resource)

**e) Add to the `Common Mistakes` table:**
```
| Writing inline interfaces in the resource module | Run extract-resource-types.ts first; import from .types.ts |
```

- [ ] **Step 2: Commit the meta-skill update**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/claude-private-skills
source ~/.zshrc 2>/dev/null
git add skills/cognigy-generate-resource/SKILL.md
git commit -m "feat: add type extraction step to resource generation workflow"
git push
```

---

### Task 5: Push everything

- [ ] **Step 1: Push the cognigy plugin repo**

```bash
cd /Users/Ben.Elliot/repos/claude-marketplace/cognigy-claude-plugin
git push
```

Expected: all commits from Tasks 1–3 pushed. Update the installed plugin in Claude Code to pick up the script and generated types.

---

## Self-Review

**Spec coverage:**
- ✅ Script generates all three interfaces per resource
- ✅ `$ref` resolution with cycle guard
- ✅ `oneOf` pure-enum collapse, complex oneOf → `unknown // TODO`
- ✅ `nullable: true` → `| null`
- ✅ `allOf` → property merge
- ✅ `required` array drives optional markers; `Update*Input` always all-optional
- ✅ `flows.ts` updated to import from generated file
- ✅ `projects.ts` updated to import from generated file
- ✅ Meta-skill updated with step 1.5, revised step 2, updated git add, new common mistake
- ✅ Back-fill run for both existing resources

**Placeholder scan:** None — all steps contain concrete commands or code.

**Type consistency:** `Flow`, `CreateFlowInput`, `UpdateFlowInput` used consistently. `Project`, `CreateProjectInput`, `UpdateProjectInput` used consistently. Import paths use `.js` extension throughout (ESM requirement).
