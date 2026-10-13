// mcp-manager.mjs — zero-dependency searchable installer for the starter kit.
// Usage:
//   node scripts/mcp-manager.mjs list [--stack <name>] [--type local|remote] [--json]
//   node scripts/mcp-manager.mjs search <query>
//   node scripts/mcp-manager.mjs add <id...> [--config ./opencode.json] [--global]
//   node scripts/mcp-manager.mjs stack <name> [--config ./opencode.json] [--global]
// Config merge rule: deep-merges `mcp` keys, never deletes existing keys.
// Env rule: NEVER writes secret values — only `{env:VAR}` placeholders + prints export hints.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import {
  loadRegistry, loadTemplate, listStacks, stackIds, searchRegistry, missingEnvFor, mergeServers, positionalArgs,
} from "./lib/registry.mjs";

const REGISTRY = loadRegistry();
const STACKS = listStacks();

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
}
function has(name) { return args.includes(name); }
function targetConfig() {
  if (has("--global")) return resolve(homedir(), ".config", "opencode", "opencode.json");
  const c = flag("--config");
  return resolve(typeof c === "string" ? c : "opencode.json");
}
function readConfig(path) {
  if (!existsSync(path)) return { $schema: "https://opencode.ai/config.json", mcp: {} };
  const raw = readFileSync(path, "utf8");
  try { return JSON.parse(raw); } catch (e) { throw new Error(`Invalid JSON in ${path}: ${e.message}`); }
}
const USAGE = `opencode MCP manager\n\n  list [--stack NAME] [--type local|remote] [--json]\n  search <query>\n  add <id...> [--config ./opencode.json] [--global]\n  stack <name> [--config ./opencode.json] [--global]\n\nStacks: ${STACKS.join(", ")}\nExample: node scripts/mcp-manager.mjs stack superapp\n         node scripts/mcp-manager.mjs search postgres\n         node scripts/mcp-manager.mjs add github sentry context7 --global`;

if (cmd === "list") {
  const stack = flag("--stack");
  const type = flag("--type");
  let rows = REGISTRY;
  if (typeof stack === "string") {
    const members = stackIds(stack);
    if (!members) { console.error(`Unknown stack '${stack}'. Available: ${STACKS.join(", ")}`); process.exit(1); }
    rows = rows.filter((r) => members.includes(r.id));
  }
  if (type) rows = rows.filter((r) => r.type === type);
  if (has("--json")) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  console.log(`\n${rows.length} MCP servers${stack ? ` in stack '${stack}'` : ""}${type ? ` [${type}]` : ""}:\n`);
  for (const r of rows) console.log(`  ${(r.id).padEnd(22)} [${r.type.padEnd(6)}] ${(r.stacks || []).join(",").padEnd(28)} ${r.title} — ${r.description.slice(0, 80)}`);
  console.log(`\nTip: node scripts/mcp-manager.mjs search <query>`);
} else if (cmd === "search") {
  const q = args[1] || "";
  if (!q) { console.error("Usage: search <query>  (e.g. search postgres)"); process.exit(1); }
  const hits = searchRegistry(REGISTRY, q);
  if (!hits.length) { console.log(`No matches for '${q}'. Try: node scripts/mcp-manager.mjs list`); process.exit(0); }
  for (const r of hits) {
    console.log(`\n== ${r.id} [${r.type}] ==`);
    console.log(`   ${r.title} — ${r.description}`);
    console.log(`   stacks: ${(r.stacks || []).join(", ")} | install: ${r.install}`);
    if (r.type === "remote") console.log(`   url: ${r.url}`);
    else console.log(`   command: ${(r.command || []).join(" ")}`);
    const req = (r.envVars || []).filter((v) => v.required).map((v) => v.name).join(", ");
    if (req) console.log(`   required env: ${req}`);
  }
  console.log(`\nAdd one: node scripts/mcp-manager.mjs add <id> [--global]`);
} else if (cmd === "add" || cmd === "stack") {
  let ids;
  if (cmd === "add") {
    ids = positionalArgs(args.slice(1));
    if (!ids.length) { console.error("Usage: add <id...>  (e.g. add github postgres context7)"); process.exit(1); }
  } else {
    const name = args[1];
    if (!name) { console.error(`Usage: stack <name>  (${STACKS.join("|")})`); process.exit(1); }
    ids = stackIds(name);
    if (!ids) { console.error(`Unknown stack '${name}'. Available: ${STACKS.join(", ")}`); process.exit(1); }
    console.log(`Stack '${name}' expands to: ${ids.join(", ")}`);
  }
  // validate ids
  for (const id of ids) if (!REGISTRY.some((r) => r.id === id)) { console.error(`Unknown id '${id}'. Run list/search first.`); process.exit(1); }
  const dest = targetConfig();
  const entries = Object.fromEntries(ids.map((id) => [id, loadTemplate(id).mcp[id]]));
  const { config: cfg, added, overwritten } = mergeServers(readConfig(dest), entries);
  for (const id of overwritten) console.log(`~ overwrite '${id}' in ${dest}`);
  for (const id of added) console.log(`+ add '${id}' -> ${dest}`);
  writeFileSync(dest, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`\nWrote ${dest}`);
  const missing = missingEnvFor(REGISTRY, ids);
  if (missing.length) {
    console.log("\nRequired environment variables (values NOT written to config — set them in your shell):");
    const isWin = process.platform === "win32";
    for (const [k, d] of missing) {
      console.log(`  - ${k}  # ${d}`);
      console.log(isWin ? `    $env:${k}="..."` : `    export ${k}="..."`);
    }
    console.log("\nOpenCode resolves them via \"{env:VAR}\" placeholders (see docs/TROUBLESHOOTING.md).");
  }
  const oauthIds = ids.filter((id) => { const e = REGISTRY.find((r) => r.id === id); return e?.type === "remote" && e?.oauth !== false && "oauth" in e; });
  if (oauthIds.length) console.log(`\nOAuth next step:\n  ${oauthIds.map((id) => `opencode mcp auth ${id}`).join("\n  ")}`);
  console.log("\nVerify: opencode mcp list");
} else if (!cmd || ["help", "--help", "-h"].includes(cmd)) {
  console.log(USAGE);
  process.exit(cmd ? 0 : 1);
} else {
  console.error(`Unknown command '${cmd}'.\n\n${USAGE}`);
  process.exit(1);
}
