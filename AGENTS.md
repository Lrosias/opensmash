# OpenSmash workflow preferences

- Prefer Smash Remix’s original multiplayer UI, assets, layouts and interaction flows. Adapt the original implementation for the expanded roster rather than adding custom branded victory panels or animated loading cards.

- Always build on top of the latest source from the publishing repository (`lrosias/main`, not the upstream `origin/main`). Fetch before starting release work and again before publishing; reconcile any newer changes and compare against the current live release. Preserve existing features and run regression checks before publishing. Never publish an older candidate over a newer release.

- Prioritize MCP tools and direct APIs over browser automation for YouGame operations.
- Existing creator keys are exported in `~/.zshrc`: `YOUGAME_API_KEY_OPENSMASH` is for the OpenSmash listings; `YOUGAME_API_KEY_CRUNCH` is a different creator account. Read only the needed key into the process, without printing it or storing it in project files.
- Check the available authenticated API options before asking Luis to sign in through a browser. A non-interactive shell may not have loaded `.zshrc`.
- A YouGame **major remix** classification is distinct from a **major version update**. Use the setting appropriate to the user's request; do not upload a new game build for a listing-only edit.

## External build storage

- Large build trees are stored at `/Volumes/OpenSmashBuilds` on OSCOO MD200, with compatibility symlinks at their old paths. Consult `docs/external-build-storage.md` and the migration results before writing to them.
- Run `python3 tools/mount-external-builds.py` before using external builds after a restart/reconnect. Do not replace a missing external build path or compatibility symlink with a new internal build directory.
- Preserve historical evidence manifests. Relocation changes canonical paths and filesystem identities; review new execution requests against their actual external paths. Check APFS workspace free space, backing ExFAT drive free space, and internal scratch/swap headroom.
