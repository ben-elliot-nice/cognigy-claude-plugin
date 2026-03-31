---
description: Delete a Cognigy resource by ID — irreversible, always confirm first
---

# Cognigy Delete

Delete a Cognigy resource. **This is irreversible.**

## When to Use

Use this skill only when the user explicitly asks to delete a resource.

## Steps

1. Identify the resource type and ID.

2. **Always confirm before deleting.** Ask: *"Are you sure you want to delete `<resource>` `<id>`? This cannot be undone."* Do not proceed until the user explicitly confirms.

3. Run the CLI:
```bash
npx tsx ~/.claude/plugins/cognigy-claude-plugin/cli/src/index.ts delete <resource> <id>
```

4. Check the result:
   - **Exit 0** — success. Output: `{ "deleted": true, "resource": "...", "id": "..." }`. Confirm to the user.
   - **Exit 2** — `.env` found via git root walk. Output contains `{ "requiresConfirmation": true, "path": "..." }`. Show the user the path and ask: *"I found a .env at `<path>` — OK to use this for the Cognigy connection?"* If confirmed, re-run adding `--env-path <path>`. If declined, stop.
   - **Exit 1** — error. Show the `error` field.

## Notes

- Never skip the confirmation step, even in composite workflows.
- If the ID is unknown, use `list` or `get` to find it first — do not guess.
