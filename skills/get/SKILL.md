---
description: Get a Cognigy resource by ID
---

# Cognigy Get

Retrieve a single Cognigy resource by ID. Returns JSON.

## When to Use

Use this skill when the user wants to fetch a specific resource and has (or can provide) an ID.

## Steps

1. Identify the resource type and ID. If the ID is unknown, suggest using the `list` skill first.

2. Run the CLI:
```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts get <resource> <id>
```

3. Check the result:
   - **Exit 0** — success. Parse and present the JSON to the user, or pass it to the next step in a composite workflow.
   - **Exit 2** — `.env` found via git root walk. Show path, ask confirmation, re-run with `--env-path <path>` if confirmed.
   - **Exit 1** — error. Show the `error` field.
     - `No .env file found` → ask user to run init: `npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts init`
     - `API error 401` → token invalid or expired
     - `Unknown resource` → resource type not yet supported

## Notes

- Do not guess IDs. If the user doesn't have an ID, use the `list` skill to find it.
- Capture the `_id` field from the result if this is part of a composite workflow.
