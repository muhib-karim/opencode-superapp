// mcp-manager.mjs — zero-dependency searchable installer for the starter kit.
// Usage:
//   node scripts/mcp-manager.mjs list [--stack <name>] [--type local|remote] [--json]
//   node scripts/mcp-manager.mjs search <query>
//   node scripts/mcp-manager.mjs add <id...> [--config ./opencode.json] [--global]
//   node scripts/mcp-manager.mjs stack <name> [--config ./opencode.json] [--global]
// Config merge rule: merges into `mcp` by id — an id that already exists is replaced by the
// template (reported as "~ overwrite"); other ids and top-level keys are never touched.
// Env rule: NEVER writes secret values — only `{env:VAR}` placeholders + prints export hints.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "..");
const REGISTRY = JSON.parse(readFileSync(resolve(KIT, "registry.json"), "utf8"));

const STACKS = "superapp, web-dev, data-analysis, devops, ai-search, productivity, testing";
const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
}
function has(name) { return args.includes(name); }
function loadTemplate(id) {
  const p = resolve(KIT, "templates", `${id}.json`);
  if (!existsSync(p)) throw new Error(`unknown server id: ${id} (no templates/${id}.json)`);
  return JSON.parse(readFileSync(p, "utf8"));
}
function targetConfig() {
  if (has("--global")) return resolve(homedir(), ".config", "opencode", "opencode.json");
  const cfg = flag("--config");
  if (cfg === true) { console.error("--config needs a file path (e.g. --config ./opencode.json)"); process.exit(1); }
  return resolve(cfg || "opencode.json");
}
function readConfig(path) {
  if (!existsSync(path)) return { $schema: "https://opencode.ai/config.json", mcp: {} };
  const raw = readFileSync(path, "utf8");
  let cfg;
  try { cfg = JSON.parse(raw); } catch (e) {
    // leave the user's file untouched; OpenCode also accepts JSONC (comments), which this manager can't merge
    console.error(`Invalid JSON in ${path}: ${e.message}\nFix it (or remove comments) and re-run; nothing was written.`);
    process.exit(1);
  }
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    console.error(`${path} must contain a JSON object; nothing was written.`);
    process.exit(1);
  }
  return cfg;
}
// local servers need their launcher (npx / uvx / docker) on PATH; warn early instead of failing inside OpenCode
const RUNTIME_HINTS = {
  npx: "ships with Node.js >= 18",
  uvx: "install uv: https://docs.astral.sh/uv/getting-started/installation/",
  docker: "install Docker and start the daemon",
};
function onPath(bin) {
  const exts = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  return (process.env.PATH || "").split(delimiter).some((d) => d && exts.some((x) => existsSync(join(d, bin + x))));
}
function missingRuntimesFor(entries) {
  const out = new Map();
  for (const [id, e] of entries) {
    const bin = e.type === "local" && e.command?.[0];
    if (bin && !onPath(bin)) out.set(bin, [...(out.get(bin) || []), id]);
  }
  return [...out.entries()];
}
function missingEnvFor(ids) {
  const out = new Map();
  for (const id of ids) {
    const e = REGISTRY.find((r) => r.id === id);
    for (const v of (e?.envVars || [])) if (v.required) out.set(v.name, v.desc);
  }
  return [...out.entries()];
}

if (cmd === "list") {
  const stack = flag("--stack");
  const type = flag("--type");
  if (stack && (stack === true || !existsSync(resolve(KIT, "stacks", `${stack}.json`)))) { console.error(`Unknown stack '${stack === true ? "" : stack}'. Available: ${STACKS}`); process.exit(1); }
  if (type && !["local", "remote"].includes(type)) { console.error("--type must be local or remote"); process.exit(1); }
  let rows = REGISTRY;
  if (stack) rows = rows.filter((r) => (r.stacks || []).includes(stack));
  if (type) rows = rows.filter((r) => r.type === type);
  if (has("--json")) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  console.log(`\n${rows.length} MCP servers${stack ? ` in stack '${stack}'` : ""}${type ? ` [${type}]` : ""}:\n`);
  for (const r of rows) console.log(`  ${(r.id).padEnd(22)} [${r.type.padEnd(6)}] ${(r.stacks || []).join(",").padEnd(28)} ${r.title} — ${r.description.slice(0, 80)}`);
  console.log(`\nTip: node scripts/mcp-manager.mjs search <query>`);
} else if (cmd === "search") {
  const q = args.slice(1).filter((a) => !a.startsWith("--")).join(" ").toLowerCase();
  if (!q) { console.error("Usage: search <query>  (e.g. search postgres)"); process.exit(1); }
  const hits = REGISTRY.filter((r) => [r.id, r.title, r.description, r.category, (r.stacks || []).join(" ")].join(" ").toLowerCase().includes(q));
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
    ids = args.slice(1).filter((a, i) => !a.startsWith("--") && args[i] !== "--config"); // args[i] precedes a
    if (!ids.length) { console.error("Usage: add <id...>  (e.g. add github postgres context7)"); process.exit(1); }
  } else {
    const name = args.slice(1).find((a, i) => !a.startsWith("--") && args[i] !== "--config"); // flags may come first
    if (!name) { console.error("Usage: stack <name>  (superapp|web-dev|data-analysis|devops|ai-search|productivity|testing)"); process.exit(1); }
    const p = resolve(KIT, "stacks", `${name}.json`);
    if (!existsSync(p)) { console.error(`Unknown stack '${name}'. Available: ${STACKS}`); process.exit(1); }
    ids = Object.keys(JSON.parse(readFileSync(p, "utf8")).mcp || {});
    console.log(`Stack '${name}' expands to: ${ids.join(", ")}`);
  }
  // validate ids
  for (const id of ids) if (!REGISTRY.some((r) => r.id === id)) { console.error(`Unknown id '${id}'. Run list/search first.`); process.exit(1); }
  const dest = targetConfig();
  const cfg = readConfig(dest);
  cfg.$schema = "https://opencode.ai/config.json";
  cfg.mcp = cfg.mcp || {};
  for (const id of ids) {
    const tpl = loadTemplate(id);
    const entry = tpl.mcp[id];
    if (cfg.mcp[id]) console.log(`~ overwrite '${id}' in ${dest}`);
    else console.log(`+ add '${id}' -> ${dest}`);
    cfg.mcp[id] = entry;
  }
  mkdirSync(dirname(dest), { recursive: true }); // --global on a fresh machine: ~/.config/opencode may not exist yet
  writeFileSync(dest, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`\nWrote ${dest}`);
  const missing = missingEnvFor(ids);
  if (missing.length) {
    console.log("\nRequired environment variables (values NOT written to config — set them in your shell):");
    const isWin = process.platform === "win32";
    for (const [k, d] of missing) {
      console.log(`  - ${k}  # ${d}`);
      console.log(isWin ? `    $env:${k}="..."` : `    export ${k}="..."`);
    }
    console.log("\nOpenCode resolves them via \"{env:VAR}\" placeholders (see docs/TROUBLESHOOTING.md).");
  }
  const runtimes = missingRuntimesFor(ids.map((id) => [id, cfg.mcp[id]]));
  if (runtimes.length) {
    console.log("\nNot found on PATH (these servers will fail to start until installed):");
    for (const [bin, who] of runtimes) console.log(`  - ${bin}  needed by: ${who.join(", ")}  (${RUNTIME_HINTS[bin] || "see docs/TROUBLESHOOTING.md"})`);
  }
  const oauthIds = ids.filter((id) => { const e = REGISTRY.find((r) => r.id === id); return e?.type === "remote" && e?.oauth !== false && "oauth" in e; });
  if (oauthIds.length) console.log(`\nOAuth next step:\n  ${oauthIds.map((id) => `opencode mcp auth ${id}`).join("\n  ")}`);
  console.log("\nVerify: opencode mcp list");
} else {
  console.log(`opencode MCP manager\n\n  list [--stack NAME] [--type local|remote] [--json]\n  search <query>\n  add <id...> [--config ./opencode.json] [--global]\n  stack <name> [--config ./opencode.json] [--global]\n\nStacks: superapp (zero-key essentials), web-dev, data-analysis, devops, ai-search, productivity, testing\nExample: node scripts/mcp-manager.mjs stack superapp\n         node scripts/mcp-manager.mjs search postgres\n         node scripts/mcp-manager.mjs add github sentry context7 --global`);
  process.exit(1);
}
