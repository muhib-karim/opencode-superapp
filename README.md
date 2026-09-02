# OpenCode SuperApp ⚡

### Turn OpenCode into a super-app with one script.

[![MCP servers](https://img.shields.io/badge/MCP-50_servers-blue)](registry.md)
[![Stacks](https://img.shields.io/badge/stacks-7-green)](docs/STACKS.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

OpenCode is already special: one agent in your terminal, **any model you like** —
and via [OpenCode Zen](https://opencode.ai/auth) a set of **free models that cost
$0 to start** (see [docs/FREE-MODELS.md](docs/FREE-MODELS.md)). What's missing
out of the box is *tools*: repo access, memory, live docs, web search, a browser.

This repo is that missing half: a curated, searchable index of the **top 50 MCP
servers** for developers, with one-click installers and standardized
`opencode.json` templates. Install OpenCode → run one script → it behaves like a
super-app: files, memory, reasoning, live docs, GitHub-scale code search, and a
real browser, from the first prompt.

## ⚡ The 3-step super-app setup

### 1. Install OpenCode (pick one)

```bash
curl -fsSL https://opencode.ai/install | bash   # macOS / Linux
npm install -g opencode-ai                       # or: bun / pnpm / yarn
brew install anomalyco/tap/opencode              # macOS Homebrew
choco install opencode                           # Windows
scoop install opencode                           # Windows alt
```

### 2. Connect free models (2 minutes, $0)

1. Sign in at [opencode.ai/auth](https://opencode.ai/auth), copy your API key.
2. In the OpenCode TUI: `/connect` → OpenCode Zen → paste the key.
3. `/models` to browse. Free starters include **Big Pickle**, **MiMo-V2.5 Free**,
   **Muse Spark Contributor Free** and more — full list in
   [docs/FREE-MODELS.md](docs/FREE-MODELS.md). Bring your own keys anytime; Zen is optional.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/muse-spark-1.3-contributor-free",
  "small_model": "opencode/big-pickle"
}
```

### 3. Run this kit — the super-app moment 🚀

```bash
git clone https://github.com/ai-dev-2024/opencode-superapp.git
cd opencode-superapp

./install.sh --superapp        # macOS / Linux / WSL  (or ./install.sh for the menu)
# .\install.ps1 -Superapp      # Windows PowerShell   (or .\install.ps1 for the menu)
```

That's it. **8 tools, zero API keys**, merged into your `./opencode.json`:

| # | Tool | Your agent can now… |
|---|---|---|
| 1 | `filesystem` | read/write/search your project safely |
| 2 | `memory` | remember things across sessions |
| 3 | `sequential-thinking` | reason step-by-step on hard problems |
| 4 | `fetch` | turn any URL into markdown |
| 5 | `time` | stop hallucinating dates and timezones |
| 6 | `context7` | pull current docs for any library |
| 7 | `gh_grep` | regex-search millions of GitHub repos for real examples |
| 8 | `playwright` | drive a real browser: click, fill, screenshot |

Verify: `opencode mcp list`. Then try:
*"Use context7 to check the latest Next.js caching docs, then use playwright
to open our staging URL and screenshot the pricing page."* — that's the super-app loop.

## Go further: 50 servers, 7 stacks

```bash
node scripts/mcp-manager.mjs list              # all 50
node scripts/mcp-manager.mjs search postgres   # searchable index
node scripts/mcp-manager.mjs stack web-dev     # +14 full-stack web tools
node scripts/mcp-manager.mjs add github sentry --global   # user-wide
```

| Stack | Command | What it adds |
|---|---|---|
| ⭐ superapp | `stack superapp` | the 8 zero-key essentials above |
| Web Dev | `stack web-dev` | git, github, browsers, figma, vercel, netlify, shadcn, supabase |
| Data Analysis | `stack data-analysis` | postgres, sqlite, mysql, mongodb, redis, supabase, prisma, neon |
| DevOps | `stack devops` | docker, k8s, terraform, aws/azure/cloudflare, grafana, datadog, sentry |
| AI Search | `stack ai-search` | brave, tavily, exa, firecrawl + docs grounding |
| Productivity | `stack productivity` | slack, discord, linear, notion, jira, confluence, drive, obsidian |
| Testing & QA | `stack testing` | playwright, puppeteer, devtools, perf harness |

Stacks merge — run twice to combine. Details: [docs/STACKS.md](docs/STACKS.md),
full index: [registry.md](registry.md), per-server templates: `templates/<id>.json`.

Keys the installer prints are set in your shell, never written to JSON:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."        # bash/zsh
$env:GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."          # PowerShell
opencode mcp auth sentry                             # OAuth servers only
opencode mcp debug <name>                            # when something fails
```

## Why this works so well with free models

Free-tier models are weakest exactly where MCP helps: stale knowledge (fixed by
Context7/Exa/Tavily), repo archaeology (GitHub/grep.app), and multi-step
verification (Playwright, sequential-thinking, memory). The `superapp` preset is
deliberately keyless so a new user on a $0 model gets the whole loop before
spending anything. When you're ready, swap in a frontier model — same tools.

## Stay out of trouble (5 rules)

1. Secrets in the shell (`{env:VAR}`), never in JSON. Full guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
2. `environment` = **local** servers; `headers` = **remote** servers. Swapping them is the #1 401.
3. Key-based remotes need `"oauth": false`; OAuth remotes need `"oauth": {}` + `opencode mcp auth <name>`.
4. ≤ 8 servers per session; gate heavy ones per-agent (see `opencode.example.json`).
5. `node scripts/validate.mjs` after every hand-edit.

## Contribute

Add a server in ~10 minutes — checklist in [CONTRIBUTING.md](CONTRIBUTING.md).
Bug reports: use the template (redact all secrets). If this turned your OpenCode
into a super-app, ⭐ star it so others find it.

MIT © ai-dev-2024. Not affiliated with OpenCode/Anomaly — config format follows the
[official MCP docs](https://opencode.ai/docs/mcp-servers/).
