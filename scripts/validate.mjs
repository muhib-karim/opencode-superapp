// validate.mjs — checks registry.json (against schema/registry.schema.json), templates/*.json
// and stacks/*.json for schema correctness and cross-file consistency. Counts are measured
// from the files, not hardcoded.
// Usage: node scripts/validate.mjs [kitDir]
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { KIT, validateKit } from "./lib/registry.mjs";

const kit = process.argv[2] ? resolve(process.argv[2]) : KIT;
const { errors, stats } = validateKit(kit);

const example = resolve(kit, "opencode.example.json");
if (existsSync(example)) {
  try { JSON.parse(readFileSync(example, "utf8")); } catch (e) { errors.push(`opencode.example.json: ${e.message}`); }
}

for (const e of errors) console.error("FAIL:", e);
if (stats.servers !== undefined) {
  console.log(`ok: registry has ${stats.servers} entries (${stats.local} local, ${stats.remote} remote), ${stats.templates} templates`);
  for (const [name, n] of Object.entries(stats.stacks)) console.log(`ok: stack ${name}: ${n} servers`);
}
if (errors.length) { console.error(`\n${errors.length} check(s) failed`); process.exit(1); }
console.log("\nAll checks passed.");
