---
name: list
description: List all Cognigy resources of a given type in the current project
---

# Cognigy List

List all resources of a type in the current project. Returns a JSON array.

## When to Use

Use this skill when the user wants to see all resources of a type — e.g. "show me all flows", "list the flows in this project".

## Finding the CLI

When Claude Code loads this skill, it injects `Base directory for this skill: <path>` into context. That path ends in `skills/list`. Go two directories up to get the plugin root. The CLI entry point is `<plugin-root>/cli/src/index.ts`.

## Steps

1. Identify the resource type from the user's request (e.g. `flow`).

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI:
```bash
npx tsx <plugin-root>/cli/src/index.ts list <resource>
```

3. Check the result:
   - **Exit 0** — success. Parse and present the JSON array to the user.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field. Common fixes:
     - `No .env file found` → invoke the `cognigy:init` skill to set up the connection, then retry this command
     - `projectId is required` → set `COGNIGY_PROJECT_ID` in `.env`
     - `API error 401` → API token in `.env` is invalid or expired

## Notes

- `list` requires `COGNIGY_PROJECT_ID` to be set in `.env` — it cannot be overridden per-call with a flag.
- Do not guess resource types. If unsure, ask the user.
