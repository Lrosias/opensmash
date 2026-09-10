# OpenSmash workflow preferences

- Prioritize MCP tools and direct APIs over browser automation for YouGame operations.
- Existing creator keys are exported in `~/.zshrc`: `YOUGAME_API_KEY_OPENSMASH` is for the OpenSmash listings; `YOUGAME_API_KEY_CRUNCH` is a different creator account. Read only the needed key into the process, without printing it or storing it in project files.
- Check the available authenticated API options before asking Luis to sign in through a browser. A non-interactive shell may not have loaded `.zshrc`.
- A YouGame **major remix** classification is distinct from a **major version update**. Use the setting appropriate to the user's request; do not upload a new game build for a listing-only edit.
