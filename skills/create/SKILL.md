---
name: create
description: Create a new Cognigy resource
---

# Cognigy Create

Create a new Cognigy resource.

## When to Use

Use this skill when the user wants to create a new resource.

## Finding the CLI

When Claude Code loads this skill, it injects `Base directory for this skill: <path>` into context. That path ends in `skills/create`. Go two directories up to get the plugin root. The CLI entry point is `<plugin-root>/cli/src/index.ts`.

## Steps

1. Identify the resource type and required fields. Ask the user for any required fields that are missing before proceeding. Check `cli/src/resources/<resource>.ts` in the plugin directory for the fields each resource accepts. Do not invent field names.

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI:
```bash
npx tsx <plugin-root>/cli/src/index.ts create <resource> --name "My Resource" [--field value ...]
```

3. Check the result:
   - **Exit 0** — success. The JSON output contains the created resource including its `_id`. Capture the `_id` if this is part of a composite workflow.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.
     - `No .env file found` → invoke the `cognigy:init` skill to set up the connection, then retry this command
     - `Unknown resource` → invoke `/private:cognigy-generate-resource` to add support, then retry. If that skill is not installed, stop and tell the user the resource is not yet supported.
     - `projectId is required` → set `COGNIGY_PROJECT_ID` in `.env` or pass `--projectId`

## Notes

- `projectId` defaults to `COGNIGY_PROJECT_ID` in `.env`. Pass `--projectId` to override for a specific call.
- Do not invent field names — only pass fields documented for the resource type.
