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

## IMPORTANT

**Do NOT read any source files before running the CLI.** The CLI will surface exactly what is missing in its error output. Reading handler files is wasted effort — the error message already tells you what to do.

## Steps

1. Identify the resource type and any IDs or flags already provided by the user.

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI immediately:

```bash
npx tsx <plugin-root>/cli/src/index.ts get <resource> [id] [--flag value ...]
```

3. Check the result:
   - **Exit 0** — success. Parse and present the JSON to the user, or pass it to the next step in a composite workflow.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.
     - `No .env file found` → invoke the `cognigy:init` skill to set up the connection, then retry
     - `requires --<flag>` → a required parent ID is missing and not set in `.env`. Ask the user for the value, then re-run with `--<flag> <value>`.
     - `get requires an ID` → re-run with the resource ID as a positional argument
     - `API error 401` → token invalid or expired
     - `Unknown resource` → invoke `/private:cognigy-generate-resource` to add support, then retry. If that skill is not installed, stop and tell the user the resource is not yet supported.

## Notes

- **Never read source files before running.** The CLI error output is authoritative — it tells you exactly what flag or ID is missing.
- Do not ask the user for IDs or flags before attempting — required values may already be set in `.env`.
- Do not guess IDs. If the user doesn't have an ID and the CLI doesn't surface it, use the `list` skill to find it.
- Capture the `_id` field from the result if this is part of a composite workflow.
