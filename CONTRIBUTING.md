# Contributing

Thanks for helping grow the kit! A new MCP server is a great first PR.

## Adding a server (checklist)

1. **Research the official transport.** Prefer the maintainer's own package/image.
   Local = `command[]` (npx / uvx / docker). Remote = `url` (+ `headers` or `oauth`).
2. **Add one entry to `registry.json`** — `id` (kebab-case, matches the `mcp` key),
   `title`, `description`, `type`, `category`, `stacks`, `command` **or** `url`,
   `envVars` (never real secrets), `install` one-liner, `toolsPrefix`.
3. **Add `templates/<id>.json`** — a minimal `{ "$schema", "mcp": { "<id>": … } }`
   snippet. Secrets only as `{env:VAR}` placeholders. Key-based remotes get
   `"oauth": false`; OAuth remotes get `"oauth": {}`.
4. **Join at least one stack** in `stacks/*.json` (or justify a new stack).
5. **Regenerate `registry.md`** with `npm run registry:md` (never hand-edit it).
6. **Run `node scripts/validate.mjs` and `npm test`** — both must pass. The validator
   also checks that `stacks/*.json` entries match their templates, that each registry
   entry's `stacks` matches the stack files, and that `registry.md` is current.
   (The 50-entry count will grow; update the count assertion in `scripts/validate.mjs`,
   plus `README.md` counts and `docs/STACKS.md`, when you add one.)

## Rules

- No API keys, tokens, or personal paths in any committed file. CI greps for common
  secret patterns; the validator rejects obvious literals.
- Pin versions (`pkg@x.y.z`) when `latest` is known-flaky; otherwise `latest` is fine.
- One concern per PR. Small diffs get reviewed fast.

## Local dev

```bash
node scripts/validate.mjs        # data checks (same as npm run validate)
npm test                         # node:test suite in test/ — zero dependencies, no npm install
npm run registry:md              # regenerate registry.md from registry.json
node scripts/mcp-manager.mjs list
node scripts/mcp-manager.mjs stack superapp --config ./test-opencode.json   # gitignored
```
