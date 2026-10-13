// registry.mjs — pure helpers shared by mcp-manager.mjs and validate.mjs (no I/O side effects
// beyond reading kit files).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./schema.mjs";

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SECRET_PATTERNS = ["sk-live", "ghp_", "xoxb-", "AKIA"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function loadRegistry(kit = KIT) { return readJson(resolve(kit, "registry.json")); }
export function loadSchema(kit = KIT) { return readJson(resolve(kit, "schema", "registry.schema.json")); }

export function listStacks(kit = KIT) {
  return readdirSync(resolve(kit, "stacks")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

// Server ids a stack installs (stacks/<name>.json is the source of truth). null if unknown.
export function stackIds(name, kit = KIT) {
  const p = resolve(kit, "stacks", `${name}.json`);
  if (!existsSync(p)) return null;
  return Object.keys(readJson(p).mcp || {});
}

export function loadTemplate(id, kit = KIT) {
  const p = resolve(kit, "templates", `${id}.json`);
  if (!existsSync(p)) throw new Error(`unknown server id: ${id} (no templates/${id}.json)`);
  return readJson(p);
}

export function searchRegistry(registry, query) {
  const q = query.toLowerCase();
  return registry.filter((r) =>
    [r.id, r.title, r.description, r.category, (r.stacks || []).join(" ")].join(" ").toLowerCase().includes(q));
}

// Required env vars (deduplicated, in first-seen order) for a set of server ids.
export function missingEnvFor(registry, ids) {
  const out = new Map();
  for (const id of ids) {
    const e = registry.find((r) => r.id === id);
    for (const v of e?.envVars || []) if (v.required) out.set(v.name, v.desc);
  }
  return [...out.entries()];
}

// Merge template entries into an opencode config. Never deletes unrelated keys.
export function mergeServers(config, entries) {
  const cfg = { ...config, $schema: "https://opencode.ai/config.json", mcp: { ...(config.mcp || {}) } };
  const added = [], overwritten = [];
  for (const [id, entry] of Object.entries(entries)) {
    (id in cfg.mcp ? overwritten : added).push(id);
    cfg.mcp[id] = entry;
  }
  return { config: cfg, added, overwritten };
}

// Positional args for `add`, skipping flags and the values of flags that take one.
export function positionalArgs(argv, valueFlags = ["--config"]) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (valueFlags.includes(argv[i])) { i++; continue; }
    if (!argv[i].startsWith("--")) out.push(argv[i]);
  }
  return out;
}

// Full consistency check of a kit directory. Returns { errors, stats }.
export function validateKit(kit = KIT) {
  const errors = [];
  const registry = loadRegistry(kit);
  errors.push(...validateSchema(registry, loadSchema(kit), "registry"));
  if (!Array.isArray(registry)) return { errors, stats: {} };

  const ids = new Set();
  for (const r of registry) {
    if (ids.has(r.id)) errors.push(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (r.type === "local" && !Array.isArray(r.command)) errors.push(`${r.id}: local needs command[]`);
    if (r.type === "remote" && !r.url) errors.push(`${r.id}: remote needs url`);
    const tplPath = resolve(kit, "templates", `${r.id}.json`);
    if (!existsSync(tplPath)) { errors.push(`${r.id}: missing templates/${r.id}.json`); continue; }
    const e = readJson(tplPath).mcp?.[r.id];
    if (!e) { errors.push(`${r.id}: template missing mcp.${r.id}`); continue; }
    if (e.type !== r.type) errors.push(`${r.id}: template type ${e.type} != registry ${r.type}`);
    if (e.type === "local" && !Array.isArray(e.command)) errors.push(`${r.id}: template command must be array`);
    if (e.type === "remote" && !e.url) errors.push(`${r.id}: template url missing`);
    const s = JSON.stringify(e);
    for (const pat of SECRET_PATTERNS) if (s.includes(pat)) errors.push(`${r.id}: template appears to contain a literal secret (${pat})`);
  }

  const templates = readdirSync(resolve(kit, "templates")).filter((f) => f.endsWith(".json"));
  for (const f of templates) if (!ids.has(f.slice(0, -5))) errors.push(`templates/${f} has no registry entry`);

  const stacks = {};
  for (const name of listStacks(kit)) {
    const members = stackIds(name, kit);
    stacks[name] = members.length;
    if (!members.length) errors.push(`stack ${name} is empty`);
    for (const k of members) if (!ids.has(k)) errors.push(`stack ${name} references unknown id ${k}`);
  }

  const stats = {
    servers: registry.length,
    local: registry.filter((r) => r.type === "local").length,
    remote: registry.filter((r) => r.type === "remote").length,
    templates: templates.length,
    stacks,
  };
  return { errors, stats };
}
