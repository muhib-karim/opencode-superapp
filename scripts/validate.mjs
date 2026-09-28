// validate.mjs — checks registry.json, templates/*.json and stacks/*.json for schema correctness.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderRegistryMd, REGISTRY_MD } from "./gen-registry-md.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "..");
let fail = 0;
const err = (m) => { fail++; console.error("FAIL:", m); };
const ok = (m) => console.log("ok:", m);
const readJson = (p) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { err(`${p}: ${e.message}`); return undefined; }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const reg = readJson(resolve(KIT, "registry.json"));
if (!Array.isArray(reg)) { console.error("\nregistry.json must be a JSON array"); process.exit(1); }
if (reg.length !== 50) err(`registry has ${reg.length} entries, want 50`);
else ok("registry has 50 entries");
const ids = new Set(reg.map((r) => r.id));
if (ids.size !== reg.length) err("duplicate ids in registry");

const templates = new Map();
for (const r of reg) {
  if (!r.id || !r.title || !r.description || !r.type) err(`missing core field in ${r.id}`);
  if (!["local", "remote"].includes(r.type)) err(`${r.id}: bad type ${r.type}`);
  if (r.type === "local" && !Array.isArray(r.command)) err(`${r.id}: local needs command[]`);
  if (r.type === "remote" && !r.url) err(`${r.id}: remote needs url`);
  const tplPath = resolve(KIT, "templates", `${r.id}.json`);
  if (!existsSync(tplPath)) { err(`${r.id}: missing templates/${r.id}.json`); continue; }
  const tpl = readJson(tplPath);
  const e = tpl?.mcp?.[r.id];
  if (!e) { err(`${r.id}: template missing mcp.${r.id}`); continue; }
  templates.set(r.id, e);
  if (e.type !== r.type) err(`${r.id}: template type ${e.type} != registry ${r.type}`);
  if (e.type === "local" && !Array.isArray(e.command)) err(`${r.id}: template command must be array`);
  if (e.type === "remote" && !e.url) err(`${r.id}: template url missing`);
  // the installer copies the template, so registry metadata must describe the same thing
  if (e.type === "local" && !same(e.command, r.command)) err(`${r.id}: registry command differs from template`);
  if (e.type === "remote" && e.url !== r.url) err(`${r.id}: registry url differs from template`);
  // secret hygiene: no literal secrets, only {env:} placeholders or documented dummy values
  const s = JSON.stringify(e);
  for (const pat of ["sk-live", "ghp_", "github_pat_", "glpat-", "xoxb-", "xoxp-", "AKIA"]) {
    if (s.includes(pat)) err(`${r.id}: template appears to contain a literal secret (${pat})`);
  }
  // OpenCode only substitutes {env:VAR}; shell-style $VAR / ${VAR} would be passed through literally
  if (/\$\{?[A-Za-z_]/.test(s)) err(`${r.id}: template uses a shell-style $VAR placeholder; use {env:VAR}`);
}
ok("templates checked");

const members = new Map(reg.map((r) => [r.id, []]));
for (const f of readdirSync(resolve(KIT, "stacks")).sort()) {
  if (!f.endsWith(".json")) continue;
  const st = readJson(resolve(KIT, "stacks", f));
  if (!st) continue;
  const name = f.replace(/\.json$/, "");
  for (const [k, entry] of Object.entries(st.mcp || {})) {
    if (!ids.has(k)) { err(`stack ${f} references unknown id ${k}`); continue; }
    members.get(k).push(name);
    // `stack <name>` installs templates/<id>.json, so the stack copy must not drift from it
    if (templates.has(k) && !same(entry, templates.get(k))) err(`stack ${f}: entry '${k}' differs from templates/${k}.json`);
  }
  ok(`stack ${f}: ${Object.keys(st.mcp || {}).length} servers`);
}
for (const r of reg) {
  const want = [...members.get(r.id)].sort();
  if (!same([...(r.stacks || [])].sort(), want)) {
    err(`${r.id}: registry stacks [${(r.stacks || []).join(", ")}] != stack files [${want.join(", ")}]`);
  }
}
ok("registry stacks match stacks/*.json");

const md = existsSync(REGISTRY_MD) ? readFileSync(REGISTRY_MD, "utf8").replace(/\r\n/g, "\n") : "";
if (md !== renderRegistryMd(reg).replace(/\r\n/g, "\n")) err("registry.md is stale — run: node scripts/gen-registry-md.mjs");
else ok("registry.md is up to date");

// example config parses
for (const f of ["opencode.example.json"]) {
  const p = resolve(KIT, f);
  if (existsSync(p) && readJson(p)) ok(`${f} parses`);
}
if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log("\nAll checks passed.");
