---
name: init
description: Set up Cognigy connection for this project by creating a .env file
---

# Cognigy Init

Set up the Cognigy connection for this project by creating a `.env` file in the current working directory.

## When to Use

- Invoked automatically by other Cognigy skills when no `.env` is found
- Called directly by the user to configure or reconfigure their Cognigy connection

## Steps

1. Check if a `.env` already exists in the current working directory. If it does, ask the user before overwriting.

2. Ask the user for:
   - **Base URL** — Cognigy instance URL (e.g. `https://app.cognigy.ai`)
   - **API Token** — found in Cognigy under Profile → API Keys
   - **Project ID** — (optional) default project to operate on; can be set later

3. Write a `.env` file to the current working directory:
```
COGNIGY_BASE_URL=<base_url>
COGNIGY_API_TOKEN=<api_token>
COGNIGY_PROJECT_ID=<project_id>
```
   Omit `COGNIGY_PROJECT_ID` if the user didn't provide one.

4. Confirm the file was written, then offer to retry the command that triggered this setup (if applicable).

## Notes

- Never display the API token value back to the user after writing it.
- If the project doesn't have `.env` in `.gitignore`, remind the user to add it — the token is a secret.
