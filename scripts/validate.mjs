// validate.mjs — checks registry.json, templates/*.json and stacks/*.json for schema correctness.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "..");
let fail = 0;
const err = (m) => { fail++; console.error("FAIL:", m); };
const ok = (m) => console.log("ok:", m);

const reg = JSON.parse(readFileSync(resolve(KIT, "registry.json"), "utf8"));
if (reg.length !== 50) err(`registry has ${reg.length} entries, want 50`);
else ok("registry has 50 entries");
const ids = new Set(reg.map((r) => r.id));
if (ids.size !== 50) err("duplicate ids in registry");

for (const r of reg) {
  if (!r.id || !r.title || !r.description || !r.type) err(`missing core field in ${r.id}`);
  if (!["local", "remote"].includes(r.type)) err(`${r.id}: bad type ${r.type}`);
  if (r.type === "local" && !Array.isArray(r.command)) err(`${r.id}: local needs command[]`);
  if (r.type === "remote" && !r.url) err(`${r.id}: remote needs url`);
  const tplPath = resolve(KIT, "templates", `${r.id}.json`);
  if (!existsSync(tplPath)) { err(`${r.id}: missing templates/${r.id}.json`); continue; }
  const tpl = JSON.parse(readFileSync(tplPath, "utf8"));
  const e = tpl.mcp?.[r.id];
  if (!e) { err(`${r.id}: template missing mcp.${r.id}`); continue; }
  if (e.type !== r.type) err(`${r.id}: template type ${e.type} != registry ${r.type}`);
  if (e.type === "local" && !Array.isArray(e.command)) err(`${r.id}: template command must be array`);
  if (e.type === "remote" && !e.url) err(`${r.id}: template url missing`);
  // secret hygiene: no literal secrets, only {env:} placeholders or documented dummy values
  const s = JSON.stringify(e);
  for (const pat of ["sk-live", "ghp_", "xoxb-", "AKIA"]) {
    if (s.includes(pat)) err(`${r.id}: template appears to contain a literal secret (${pat})`);
  }
}
ok("templates checked");

for (const f of readdirSync(resolve(KIT, "stacks"))) {
  if (!f.endsWith(".json")) continue;
  const st = JSON.parse(readFileSync(resolve(KIT, "stacks", f), "utf8"));
  for (const k of Object.keys(st.mcp || {})) {
    if (!ids.has(k)) err(`stack ${f} references unknown id ${k}`);
  }
  ok(`stack ${f}: ${Object.keys(st.mcp || {}).length} servers`);
}
// example config parses
for (const f of ["opencode.example.json"]) {
  const p = resolve(KIT, f);
  if (existsSync(p)) { JSON.parse(readFileSync(p, "utf8")); ok(`${f} parses`); }
}
if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log("\nAll checks passed.");
