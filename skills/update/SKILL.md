---
name: update
description: Update an existing Cognigy resource by ID
---

# Cognigy Update

Update fields on an existing Cognigy resource.

## When to Use

Use this skill when the user wants to modify a resource they already have an ID for. If the ID is unknown, use `list` or `get` first.

## Finding the CLI

When Claude Code loads this skill, it injects `Base directory for this skill: <path>` into context. That path ends in `skills/update`. Go two directories up to get the plugin root. The CLI entry point is `<plugin-root>/cli/src/index.ts`.

## Steps

1. Identify the resource type, ID, and fields to update.

2. Derive `<plugin-root>` from the `Base directory for this skill:` path (two directories up). Run the CLI:
```bash
npx tsx <plugin-root>/cli/src/index.ts update <resource> <id> --<field> <value> [--<field> <value> ...]
```

   Example — rename a flow:
   ```bash
   npx tsx <plugin-root>/cli/src/index.ts update flow flow-abc123 --name "Better Name"
   ```

3. Check the result:
   - **Exit 0** — success. JSON output contains the updated resource.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.

## Notes

- Only pass the fields you want to change — unspecified fields are left unchanged (PATCH semantics).
- Do not guess IDs. If the ID is unknown, use `list` or `get` first.
