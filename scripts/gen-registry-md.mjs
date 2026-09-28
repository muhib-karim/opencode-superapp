// gen-registry-md.mjs — regenerates registry.md (the human-readable index) from registry.json + templates/.
// Usage: node scripts/gen-registry-md.mjs          (validate.mjs fails if registry.md is stale)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "..");
export const REGISTRY_MD = resolve(KIT, "registry.md");

// inline code span that survives embedded backticks (e.g. "(remote — `opencode mcp auth x`)")
const code = (s) => (s.includes("`") ? `\`\` ${s} \`\`` : `\`${s}\``);

export function renderRegistryMd(reg = JSON.parse(readFileSync(resolve(KIT, "registry.json"), "utf8"))) {
  const L = [];
  L.push(`# Registry — ${reg.length} MCP servers`, "");
  L.push("Search: Ctrl+F this file, or run `node scripts/mcp-manager.mjs search <query>`. Templates: `templates/<id>.json`.", "");
  L.push("| # | ID | Type | Title | Stacks | Secrets | Install |", "|---|---|---|---|---|---|---|");
  reg.forEach((r, i) => {
    const req = (r.envVars || []).filter((v) => v.required).map((v) => v.name);
    const secrets = req.length ? req.join(", ") : r.oauth && typeof r.oauth === "object" ? "OAuth" : "—";
    const stacks = (r.stacks || []).join(", ") || "—";
    L.push(`| ${i + 1} | \`${r.id}\` | ${r.type} | ${r.title} | ${stacks} | ${secrets} | ${code(r.install)} |`);
  });
  L.push("", "## Notes", "");
  for (const r of reg) {
    const tpl = JSON.parse(readFileSync(resolve(KIT, "templates", `${r.id}.json`), "utf8")).mcp[r.id];
    const how = tpl.type === "remote" ? tpl.url : tpl.command.join(" ");
    L.push(`- **${r.id}** (${r.type}) — ${r.description}  `);
    L.push(`  ${code(how)} — template \`templates/${r.id}.json\``);
  }
  return L.join("\r\n") + "\r\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  writeFileSync(REGISTRY_MD, renderRegistryMd());
  console.log(`Wrote ${REGISTRY_MD}`);
}
