---
description: Create a new Cognigy resource
---

# Cognigy Create

Create a new Cognigy resource.

## When to Use

Use this skill when the user wants to create a new resource.

## Steps

1. Identify the resource type and required fields. Ask the user for any required fields that are missing before proceeding.

   For `flow`: requires `--name`. Optional: `--description`, `--projectId` (overrides `.env` default).

2. Run the CLI:
```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts create <resource> --name "My Resource" [--field value ...]
```

3. Check the result:
   - **Exit 0** — success. The JSON output contains the created resource including its `_id`. Capture the `_id` if this is part of a composite workflow.
   - **Exit 2** — `.env` found via git root walk. Show path, ask confirmation, re-run with `--env-path <path>` if confirmed.
   - **Exit 1** — error. Show the `error` field.
     - `projectId is required` → set `COGNIGY_PROJECT_ID` in `.env` or pass `--projectId`

## Notes

- `projectId` defaults to `COGNIGY_PROJECT_ID` in `.env`. Pass `--projectId` to override for a specific call.
- Do not invent field names — only pass fields documented for the resource type.
