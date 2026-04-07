---
name: get
description: Get a Cognigy resource by ID
---

# Cognigy Get

Retrieve a single Cognigy resource by ID. Returns JSON.

## When to Use

Use this skill when the user wants to fetch a specific resource and has (or can provide) an ID.

## Finding the CLI

When Claude Code loads this skill, it injects `Base directory for this skill: <path>` into context. That path ends in `skills/get`. Go two directories up to get the plugin root. The CLI entry point is `<plugin-root>/cli/src/index.ts`.

## Steps

1. Identify the resource type. Before running, check the resource handler at `<plugin-root>/cli/src/resources/<resource>.ts` and look for a `requires` field:
   - **No `requires` field** → resource is identified by a positional ID: `get <resource> <id>`
   - **Has `requires` field** → resource is identified by parent IDs passed as flags, not a positional ID. The `requires` array lists the flag names needed (e.g. `requires: ['flowId']` means pass `--flowId <value>`).

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI:
```bash
# Standard resource (no requires)
npx tsx <plugin-root>/cli/src/index.ts get <resource> <id>

# Sub-resource (has requires)
npx tsx <plugin-root>/cli/src/index.ts get <resource> --<requiredKey> <value>
```

3. Check the result:
   - **Exit 0** — success. Parse and present the JSON to the user, or pass it to the next step in a composite workflow.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.
     - `No .env file found` → invoke the `cognigy:init` skill to set up the connection, then retry this command
     - `requires --<flag>` → a required parent ID flag was not passed. Read the `requires` field from the handler and re-run with the correct flags.
     - `API error 401` → token invalid or expired
     - `Unknown resource` → invoke `/private:cognigy-generate-resource` to add support, then retry. If that skill is not installed, stop and tell the user the resource is not yet supported.

## Notes

- Do not guess IDs. If the user doesn't have an ID, use the `list` skill to find it.
- For resources with `requires`, the parent IDs are the only identifiers — there is no separate positional ID.
- Capture the `_id` field from the result if this is part of a composite workflow.
