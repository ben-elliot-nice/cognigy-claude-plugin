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
     - `invoke requires --op` → re-run the command with `--op <operation-name>`. To find available operations for a resource, read `<plugin-root>/cli/src/resources/<resource>.ts` and look for the `operations` key.
     - `has no operation` → the operation is not implemented. Check the resource handler or tell the user it is not yet supported.
     - `Unknown resource` → invoke `/private:cognigy-generate-resource` to add support, then retry. If that skill is not installed, stop and tell the user the resource is not yet supported.
     - `API error 401` → token invalid or expired

## Notes

- `invoke` always requires a resource ID and `--op <name>`.
- Additional flags (e.g. `--targetProjectId`) are forwarded to the operation handler as `params`.
- To see what operations a resource supports, read its handler file: `cli/src/resources/<resource>.ts` and look for the `operations` key.
