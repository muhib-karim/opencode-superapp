# Stacks

Pre-composed `opencode.json` fragments in `stacks/`. Each file is a complete
`{ "$schema", "mcp": { … } }` object — merge it with the installer, don't hand-edit.

| Stack file | Use when | Servers |
|---|---|---|
| `superapp.json` ⭐ | **start here** — zero-API-key essentials, the super-app loop | filesystem, memory, sequential-thinking, fetch, time, context7, gh_grep, playwright (8) |
| `web-dev.json` | full-stack web apps | filesystem, git, github, fetch, playwright, puppeteer, chrome-devtools, figma, vercel, netlify, shadcn, context7, gh_grep, supabase (14) |
| `data-analysis.json` | SQL/NoSQL + analysis | postgres, sqlite, mysql, mongodb, redis, supabase, prisma, neon, sequential-thinking, memory (10) |
| `devops.json` | containers, IaC, clouds, on-call | docker, kubernetes, terraform, aws-docs, azure, cloudflare, digitalocean, grafana, datadog, sentry, github, gitlab (12) |
| `ai-search.json` | ground answers in live docs/web | brave-search, tavily, exa, firecrawl, fetch, context7, gh_grep, sequential-thinking, memory, youtube-transcript (10) |
| `productivity.json` | tickets, docs, chat | slack, discord, linear, notion, atlassian-jira, atlassian-confluence, google-drive, obsidian, time (9) |
| `testing.json` | browser QA + perf | playwright, puppeteer, chrome-devtools, firecrawl, everything, time, fetch (7) |

Install:

```bash
node scripts/mcp-manager.mjs stack superapp          # zero-key essentials -> ./opencode.json
node scripts/mcp-manager.mjs stack web-dev           # add a full stack on top
node scripts/mcp-manager.mjs stack devops --global   # ~/.config/opencode/opencode.json
```

Combine stacks by running the command twice — keys merge, nothing is deleted.
If two stacks share an id (e.g. `github` in web-dev + devops) the last run wins,
which is safe because templates are identical.

Keep sessions lean: after installing a stack, disable the heavy hitters globally
and re-enable per-agent (pattern in `opencode.example.json`):

```json
{ "tools": { "github_*": false }, "agent": { "dev": { "tools": { "github_*": true } } } }
```
