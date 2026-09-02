# Security policy

This repo ships **configuration templates only** — no credentials are bundled,
and none should ever be committed.

- Secrets live in your shell (`export FOO=…` / `$env:FOO=…`) and are referenced
  in JSON exclusively via `{env:FOO}` placeholders.
- `environment` is for `type: "local"` servers; `headers` is for `type: "remote"`.
- Never paste real tokens into GitHub issues — redact to `…` / `xxxx`.
- OAuth tokens issued by `opencode mcp auth` are stored by OpenCode itself
  (`~/.local/share/opencode/mcp-auth.json`); this project never touches them.

Found a leaked secret or a template that encourages an unsafe pattern?
Open an issue (redacted) or a PR fixing the template — safe-template PRs jump the queue.
