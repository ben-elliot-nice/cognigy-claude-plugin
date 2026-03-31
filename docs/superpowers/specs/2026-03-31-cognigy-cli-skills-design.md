# Cognigy Claude Plugin — CLI + Skills Architecture Design

**Date:** 2026-03-31
**Status:** Approved

---

## Overview

A Claude Code plugin that provides skills for interacting with the Cognigy platform. Skills invoke a bundled TypeScript CLI; per-project configuration lives in a `.env` file in the consuming repo, never in the plugin itself.

The design optimises for learning over completeness. The first milestone proves the end-to-end architecture works before scaling resource coverage.

---

## Repository Structure

```
cognigy-claude-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── get/SKILL.md              # Atomic
│   ├── create/SKILL.md           # Atomic
│   ├── update/SKILL.md           # Atomic
│   ├── delete/SKILL.md           # Atomic
│   └── create-ai-agent/SKILL.md  # Composite (example)
├── cli/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts              # Entry point + command router
│   │   ├── lib/
│   │   │   ├── env.ts            # .env discovery
│   │   │   ├── client.ts         # HTTP client + auth
│   │   │   └── types.ts          # Shared types
│   │   └── resources/            # Generated resource modules
│   │       └── flows.ts          # First module (meta-skill generated)
│   └── openapi/
│       └── cognigy.yaml          # Bundled Cognigy OpenAPI spec
└── docs/
    └── superpowers/
        └── specs/
```

---

## Layered Architecture

```
Composite skills          (create-ai-agent, clone-flow, etc.)
    ↓ orchestrate
Atomic skills             (get, create, update, delete)
    ↓ invoke
CLI TypeScript modules    (flows.ts, ai-agents.ts, tools.ts, etc.)
    ↓ call
Cognigy REST API
```

**Namespace stays flat because the dimensions are orthogonal:**
- Skills = 4 CRUD verbs + N composite workflows
- TS modules = one per Cognigy resource type

Adding a new resource requires one new TS module. The 4 atomic skills need no changes.

---

## CLI Invocation

Skills invoke the CLI via:

```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts <verb> <resource> [id] [options]
```

Examples:
```bash
npx tsx ...index.ts get flow abc123
npx tsx ...index.ts create ai-agent --name "My Agent" --project def456
npx tsx ...index.ts init
```

**Runtime:** `npx tsx` — no build step, no pre-install required. Node 24 LTS is available in the environment.

**Output:** JSON to stdout always, enabling Claude to parse and chain results between atomic skill calls.

---

## .env Contract

**Location:** Consuming project root — never in the plugin directory.

**Required:**
```bash
COGNIGY_BASE_URL=https://app.cognigy.ai
COGNIGY_API_TOKEN=your-token-here
```

**Optional defaults** (overridable per CLI call):
```bash
COGNIGY_PROJECT_ID=
COGNIGY_FLOW_ID=
```

**Discovery order:**
1. Look for `.env` in cwd — use silently if found
2. Walk up to git root — if found, print the path and ask Claude to confirm before proceeding
3. Neither found — CLI instructs user to run `cognigy init`

**`init` command:** Writes a commented `.env` template to cwd. Does not overwrite an existing file.

---

## Atomic Skills

Each atomic skill (`get`, `create`, `update`, `delete`) is resource-agnostic. It describes:
- What the verb does across any resource
- The CLI invocation pattern
- How to interpret JSON output
- What to do if an operation requires clarification (ask, don't guess)

The skill does **not** contain resource-specific knowledge. If `get ai-agent` internally requires 3 API calls, that complexity belongs in `ai-agents.ts`, not the skill.

---

## Composite Skills

A composite skill is an ordered sequence of atomic calls with context passing between them. Claude is the orchestrator.

Example — `create-ai-agent`:
```
1. create flow          → capture flowId
2. create ai-agent      → capture agentId, pass flowId
3. create tool × N      → pass agentId
4. get chart            → pass flowId, render result
```

The composite skill defines the sequence, what to capture from each result, and what to pass forward.

---

## TS Resource Module Contract

Every `resources/*.ts` module must export a handler object matching this shape:

```typescript
export const <resource> = {
  get:    (id: string, client: CognigyClient) => Promise<Result>,
  create: (params: CreateParams, client: CognigyClient) => Promise<Result>,
  update: (id: string, params: UpdateParams, client: CognigyClient) => Promise<Result>,
  delete: (id: string, client: CognigyClient) => Promise<void>,
}
```

`index.ts` routes `get flow abc123` → `flows.get('abc123', client)`.

Not every resource needs all four verbs — only implement what the Cognigy API supports for that resource.

---

## The Meta-Skill

**Where it lives:** The author's personal Claude setup. Not published in this plugin.

**Purpose:** Generate new resource modules from the bundled OpenAPI spec. The quality gate is the author reviewing the output and committing + pushing to GitHub.

**Process:**
1. Accept a resource name as input (e.g. "ai-agent")
2. Read `cli/openapi/cognigy.yaml` to find relevant endpoints
3. Generate a typed `cli/src/resources/<resource>.ts` matching the module contract above
4. Wire it into `cli/src/index.ts`
5. Author reviews, commits, pushes

**Feedback loop:** The first approved module becomes the reference example for subsequent generations, improving output quality over time.

---

## Validation Experiment (First Milestone)

The first milestone is designed to answer two architectural questions before scaling:

**Q1: Does the meta-skill reliably generate correct TypeScript from the OpenAPI spec?**

Use the meta-skill to generate `flows.ts` (the first resource module). Review the output:
- Good → meta-skill proven, first module ready, proceed
- Bad → learned early, hand-write `flows.ts`, architecture unchanged, scale manually

**Q2: Does a generic atomic skill hold up across structurally different resources?**

1. Wire `flows.ts` into the generic `get` skill
2. Without changing the skill, use it for a second resource (e.g. AI Agent)
3. Observe where it breaks:
   - Break in the skill → skills need some resource-awareness
   - Break in the TS module → TS handles it, skill stays generic (expected outcome)
   - Break in result interpretation → composite skill layer is the fix

**Build order:**
```
CLI shell → bundle OpenAPI spec → meta-skill → generates flows.ts
→ wire into get skill → test against second resource → validate atomic skill design
```

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| CLI runtime | `npx tsx` | No build step; Node 24 guaranteed |
| CLI distribution | Bundled in plugin | Opacity is a feature — skills don't expose how |
| .env location | Consuming project root | Config belongs to the project, not the plugin |
| .env discovery | cwd → git root walk with confirm | Silent happy path; explicit on ambiguity |
| Output format | JSON stdout | Enables chaining between atomic calls |
| Skill namespace | 4 CRUD atomics + composites | Orthogonal to resource dimension; doesn't scale linearly |
| Resource modules | One TS file per resource | Single responsibility; meta-skill unit of generation |
| Meta-skill location | Author's personal setup | Not published; commit+push is the quality gate |
| First milestone | Prove meta-skill + atomic skill design | Optimise for learning, not completeness |
