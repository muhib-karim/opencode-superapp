# One-click installer: turn OpenCode into a super-app (Windows PowerShell).
# Usage:
#   .\install.ps1                          # interactive: superapp first, then stacks
#   .\install.ps1 -Superapp                # star zero-API-key essentials (recommended start)
#   .\install.ps1 -Stack web-dev           # install a whole stack into .\opencode.json
#   .\install.ps1 -Add github,sentry       # install individual servers
#   .\install.ps1 -Add github -Global      # install into ~/.config/opencode/opencode.json
#   .\install.ps1 -Superapp -Config C:\proj\opencode.json   # write a specific config file
#   .\install.ps1 -List                    # list all 50 servers
#   .\install.ps1 -Search postgres         # searchable index
param(
  [string]$Stack,
  [string]$Config,
  [string[]]$Add,
  [switch]$Superapp,
  [switch]$Global,
  [switch]$List,
  [string]$Search,
  [switch]$Validate
)
$ErrorActionPreference = "Stop"
$KitDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "node >=18 required (https://nodejs.org). Install it, then re-run."
}
$mgr = Join-Path $KitDir "scripts\mcp-manager.mjs"
$extra = @()
if ($Global) { $extra += "--global" }
if ($Config) { $extra += @("--config", $Config) }
# `pwsh -File install.ps1 -Add github,sentry` passes one string; split it like an in-session array
if ($Add) { $Add = @($Add | ForEach-Object { $_ -split "," } | Where-Object { $_ }) }

# propagate node's exit code so scripts/CI can tell a failed install from a good one
if ($Validate) { node (Join-Path $KitDir "scripts\validate.mjs"); exit $LASTEXITCODE }
if ($List) { node $mgr list @extra; exit $LASTEXITCODE }
if ($Search) { node $mgr search $Search; exit $LASTEXITCODE }
if ($Superapp) { node $mgr stack superapp @extra; exit $LASTEXITCODE }
if ($Stack) { node $mgr stack $Stack @extra; exit $LASTEXITCODE }
if ($Add) { node $mgr add @Add @extra; exit $LASTEXITCODE }

# interactive menu
Write-Output "OpenCode super-app installer - pick one:"
Write-Output "  0) superapp (8 zero-key essentials - start here)"
Write-Output "  1) web-dev       (files, git, browser, hosting, UI)"
Write-Output "  2) data-analysis (SQL/NoSQL + reasoning memory)"
Write-Output "  3) devops        (containers, IaC, clouds, observability)"
Write-Output "  4) ai-search     (web search, scrape, docs grounding)"
Write-Output "  5) productivity  (tickets, docs, chat)"
Write-Output "  6) testing       (browsers, perf, reference harness)"
$choice = Read-Host "Choice [0-6]"
$map = @{ "0" = "superapp"; "" = "superapp"; "1" = "web-dev"; "2" = "data-analysis"; "3" = "devops"; "4" = "ai-search"; "5" = "productivity"; "6" = "testing" }
if (-not $map.ContainsKey($choice)) { Write-Output "cancelled"; return }
node $mgr stack $map[$choice] @extra
exit $LASTEXITCODE
