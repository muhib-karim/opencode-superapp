// Smoke tests: run the real CLIs as child processes against a temp config file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KIT, loadRegistry, stackIds } from "../scripts/lib/registry.mjs";

const MANAGER = join(KIT, "scripts", "mcp-manager.mjs");
const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
const cli = (...args) => run(MANAGER, ...args);

test("--help prints usage and exits 0", () => {
  for (const flag of ["--help", "-h", "help"]) {
    const r = cli(flag);
    assert.equal(r.status, 0, flag);
    assert.match(r.stdout, /opencode MCP manager/);
    assert.match(r.stdout, /superapp/);
  }
});

test("no command or unknown command exits 1", () => {
  assert.equal(cli().status, 1);
  const r = cli("frobnicate");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown command 'frobnicate'/);
});

test("list --json returns the whole registry", () => {
  const r = cli("list", "--json");
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).length, loadRegistry().length);
});

test("list --stack uses the stack file and --type filters", () => {
  const rows = JSON.parse(cli("list", "--stack", "superapp", "--json").stdout);
  assert.deepEqual(rows.map((r) => r.id).sort(), stackIds("superapp").sort());
  const remote = JSON.parse(cli("list", "--type", "remote", "--json").stdout);
  assert.ok(remote.length > 0 && remote.every((r) => r.type === "remote"));
  assert.equal(cli("list", "--stack", "nope").status, 1);
});

test("search finds a server and requires a query", () => {
  const r = cli("search", "postgres");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /== postgres \[local\] ==/);
  assert.equal(cli("search").status, 1);
});

test("stack writes a config, merges with existing keys, and never writes secret values", () => {
  const dir = mkdtempSync(join(tmpdir(), "superapp-cli-"));
  const cfg = join(dir, "opencode.json");
  try {
    writeFileSync(cfg, JSON.stringify({ model: "opencode/big-pickle", mcp: { mine: { type: "local", command: ["x"] } } }));
    const r = cli("stack", "superapp", "--config", cfg);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(readFileSync(cfg, "utf8"));
    assert.equal(out.model, "opencode/big-pickle");
    assert.ok(out.mcp.mine);
    for (const id of stackIds("superapp")) assert.ok(out.mcp[id], id);

    const a = cli("add", "github", "--config", cfg);
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, /GITHUB_PERSONAL_ACCESS_TOKEN/);
    const after = readFileSync(cfg, "utf8");
    assert.match(after, /\{env:GITHUB_PERSONAL_ACCESS_TOKEN\}/);
  } finally { rmSync(dir, { recursive: true }); }
});

test("add rejects unknown ids and unknown stacks without writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "superapp-cli-"));
  try {
    const cfg = join(dir, "opencode.json");
    assert.equal(cli("add", "not-a-server", "--config", cfg).status, 1);
    assert.equal(cli("stack", "not-a-stack", "--config", cfg).status, 1);
    assert.throws(() => readFileSync(cfg));
  } finally { rmSync(dir, { recursive: true }); }
});

test("validate.mjs passes on the shipped kit", () => {
  const r = run(join(KIT, "scripts", "validate.mjs"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /All checks passed/);
});
