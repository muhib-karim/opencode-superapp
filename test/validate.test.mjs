// Tests for scripts/validate.mjs: the shipped data passes, and real breakage is detected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validate = (root = KIT) =>
  spawnSync(process.execPath, [join(root, "scripts", "validate.mjs")], { encoding: "utf8" });

// a throwaway copy of the kit's data + scripts that a test can corrupt
function kitCopy() {
  const dir = mkdtempSync(join(tmpdir(), "superapp-validate-"));
  for (const p of ["registry.json", "registry.md", "opencode.example.json", "scripts", "templates", "stacks"]) {
    cpSync(join(KIT, p), join(dir, p), { recursive: true });
  }
  return dir;
}
const editJson = (path, fn) => {
  const j = JSON.parse(readFileSync(path, "utf8"));
  fn(j);
  writeFileSync(path, JSON.stringify(j, null, 2));
};

test("shipped registry, templates and stacks pass validation", () => {
  const r = validate();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /All checks passed\./);
});

test("every template is a standalone OpenCode config with one mcp entry named after the file", () => {
  for (const f of readdirSync(join(KIT, "templates"))) {
    const tpl = JSON.parse(readFileSync(join(KIT, "templates", f), "utf8"));
    assert.equal(tpl.$schema, "https://opencode.ai/config.json", f);
    assert.deepEqual(Object.keys(tpl.mcp), [f.replace(/\.json$/, "")], f);
  }
});

test("detects a shell-style ${VAR} placeholder (OpenCode only expands {env:VAR})", () => {
  const dir = kitCopy();
  editJson(join(dir, "templates", "time.json"), (j) => j.mcp.time.command.push("${TZ}"));
  const r = validate(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /time: template uses a shell-style/);
});

test("detects stack entries drifting from templates and registry stack drift", () => {
  const dir = kitCopy();
  editJson(join(dir, "stacks", "superapp.json"), (j) => (j.mcp.memory.command = ["npx", "-y", "something-else"]));
  editJson(join(dir, "registry.json"), (j) => (j.find((r) => r.id === "stripe").stacks = ["web-dev"]));
  const r = validate(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stack superapp\.json: entry 'memory' differs/);
  assert.match(r.stderr, /stripe: registry stacks \[web-dev\] != stack files \[\]/);
});

test("detects a stale registry.md and reports malformed JSON without crashing", () => {
  const dir = kitCopy();
  writeFileSync(join(dir, "registry.md"), "# out of date\n");
  writeFileSync(join(dir, "stacks", "testing.json"), "{ broken");
  const r = validate(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /registry\.md is stale/);
  assert.match(r.stderr, /FAIL: .*testing\.json/);
  assert.doesNotMatch(r.stderr, /^\s+at /m, "should not print a stack trace");
});

test("detects a literal secret in a template", () => {
  const dir = kitCopy();
  editJson(join(dir, "templates", "github.json"), (j) => (j.mcp.github.environment.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_" + "x".repeat(20)));
  const r = validate(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /github: template appears to contain a literal secret/);
});
