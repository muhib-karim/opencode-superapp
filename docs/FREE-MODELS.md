# Free models on OpenCode (why the "super-app" story works)

OpenCode is model-agnostic (bring any provider key), but the cheapest on-ramp is
**OpenCode Zen** — the team's curated gateway of models benchmarked to work well
as coding agents. It is optional; OpenCode works fine without it.

## The free tier (live list rotates — verify before you promise)

As of September 2026, Zen serves these **$0 / 1M-token** models:

| Model | Config id | Note |
|---|---|---|
| Big Pickle | `opencode/big-pickle` | stealth model, free for a limited time |
| MiMo-V2.5 Free | `opencode/mimo-v2.5-free` | feedback-preview window |
| Ling 3.0 Flash Fin Free | `opencode/ling-3.0-flash-fin-free` | feedback-preview window |
| Nemotron 3 Ultra Free | `opencode/nemotron-3-ultra-free` | NVIDIA trial endpoint — no personal/confidential data |
| Nemotron 3.5 Lightning Free | `opencode/nemotron-3.5-lightning-free` | NVIDIA trial endpoint — same caution |
| Muse Spark 1.3 Contributor Free | `opencode/muse-spark-1.3-contributor-free` | free in exchange for training-use of prompts/completions |
| Muse Spark 1.2 Contributor Free | `opencode/muse-spark-1.2-contributor-free` | same contributor terms |

Live catalogue: `https://opencode.ai/zen/v1/models`. Everything else on Zen is
pay-as-you-go per 1M tokens (e.g. GPT/Gemini/Claude/Kimi/DeepSeek/Qwen families),
plus your own OpenAI/Anthropic keys via "bring your own key" (billed by the provider).

## Connect (2 minutes)

1. Sign in at `https://opencode.ai/auth`, add billing details, copy the API key.
2. In the OpenCode TUI run `/connect`, pick OpenCode Zen, paste the key.
3. Run `/models` to browse; start free, e.g.:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/muse-spark-1.3-contributor-free",
  "small_model": "opencode/big-pickle"
}
```

## Why pair free models with this kit

Free-tier models are weakest at precisely what MCP fixes: stale knowledge
(Context7, Exa, Tavily), repo archaeology (GitHub, grep.app), and multi-step
verification (Playwright, sequential-thinking, memory). The `superapp` stack is
deliberately **zero-API-key** so a brand-new user on a free model gets the full
super-app loop — files, memory, reasoning, live docs, web search, browser —
before spending a cent or signing up for anything beyond Zen.
