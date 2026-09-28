// Smoke tests for scripts/mcp-manager.mjs, install.sh and install.ps1 — run with `npm test` (node:test, zero dependencies).
// Every test writes to a fresh temp dir; nothing touches ./opencode.json or the real ~/.config/opencode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MGR = join(KIT, "scripts", "mcp-manager.mjs");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const tmp = () => mkdtempSync(join(tmpdir(), "superapp-test-"));
const run = (args, { cwd = KIT, env = {} } = {}) =>
  spawnSync(process.execPath, [MGR, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
const stackIds = (name) => Object.keys(readJson(join(KIT, "stacks", `${name}.json`)).mcp);
const template = (id) => readJson(join(KIT, "templates", `${id}.json`)).mcp[id];
const STACKS = readdirSync(join(KIT, "stacks")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const N = readJson(join(KIT, "registry.json")).length; // scripts/validate.mjs pins the expected count

test("list --json returns every registry entry", () => {
  const r = run(["list", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, N);
  assert.equal(new Set(rows.map((x) => x.id)).size, N);
});

test("list --stack <name> shows exactly what `stack <name>` installs", () => {
  assert.ok(STACKS.includes("superapp"));
  for (const name of STACKS) {
    const r = run(["list", "--stack", name, "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const listed = JSON.parse(r.stdout).map((x) => x.id).sort();
    assert.deepEqual(listed, stackIds(name).sort(), `stack ${name}`);
  }
});

test("search finds servers and handles no-match / missing query", () => {
  const hit = run(["search", "postgres"]);
  assert.equal(hit.status, 0, hit.stderr);
  assert.match(hit.stdout, /== postgres \[local\] ==/);
  assert.match(hit.stdout, /required env: POSTGRES_CONNECTION_STRING/);
  const miss = run(["search", "no-such-server-xyz"]);
  assert.equal(miss.status, 0);
  assert.match(miss.stdout, /No matches/);
  assert.equal(run(["search"]).status, 1);
});

test("stack superapp writes the 8 zero-key servers exactly as templated", () => {
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  const r = run(["stack", "superapp", "--config", cfgPath]);
  assert.equal(r.status, 0, r.stderr);
  const cfg = readJson(cfgPath);
  assert.equal(cfg.$schema, "https://opencode.ai/config.json");
  assert.deepEqual(Object.keys(cfg.mcp), stackIds("superapp"));
  assert.equal(Object.keys(cfg.mcp).length, 8);
  for (const id of Object.keys(cfg.mcp)) assert.deepEqual(cfg.mcp[id], template(id), id);
  // OpenCode only expands {env:VAR}; a literal ${VAR} would reach the server unexpanded
  assert.doesNotMatch(readFileSync(cfgPath, "utf8"), /\$\{/);
  assert.deepEqual(cfg.mcp.filesystem.command.slice(-1), ["."]);
  assert.doesNotMatch(r.stdout, /Required environment variables/, "superapp must need no API keys");
});

test("stacks merge into an existing config without deleting user keys", () => {
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  const mine = { type: "local", command: ["my-server"], enabled: true };
  writeFileSync(cfgPath, JSON.stringify({ model: "opencode/big-pickle", tools: { "github_*": false }, mcp: { mine } }));
  assert.equal(run(["stack", "testing", "--config", cfgPath]).status, 0);
  const again = run(["add", "github", "time", "--config", cfgPath]);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /~ overwrite 'time'/);
  const cfg = readJson(cfgPath);
  assert.equal(cfg.model, "opencode/big-pickle");
  assert.deepEqual(cfg.tools, { "github_*": false });
  assert.deepEqual(cfg.mcp.mine, mine);
  for (const id of [...stackIds("testing"), "github"]) assert.ok(cfg.mcp[id], `missing ${id}`);
});

test("secrets are never written — only {env:VAR} placeholders plus shell hints", () => {
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  const secret = "test-secret-value-do-not-write";
  const r = run(["add", "github", "exa", "--config", cfgPath], {
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: secret, EXA_API_KEY: secret },
  });
  assert.equal(r.status, 0, r.stderr);
  const raw = readFileSync(cfgPath, "utf8");
  assert.ok(!raw.includes(secret), "secret value leaked into config");
  assert.match(raw, /\{env:GITHUB_PERSONAL_ACCESS_TOKEN\}/);
  assert.match(raw, /\{env:EXA_API_KEY\}/);
  assert.match(r.stdout, /GITHUB_PERSONAL_ACCESS_TOKEN/);
  assert.ok(!r.stdout.includes(secret), "secret value echoed to stdout");
});

test("OAuth hint only for OAuth remotes", () => {
  const dir = tmp();
  const r = run(["add", "sentry", "context7", "--config", join(dir, "opencode.json")]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /opencode mcp auth sentry/);
  assert.doesNotMatch(r.stdout, /opencode mcp auth context7/);
});

test("warns when a server's launcher (uvx) is not on PATH", { skip: process.platform === "win32" && "PATH handling differs on Windows" }, () => {
  const dir = tmp();
  // only node's own bin dir: npx is there, uvx is not
  const r = run(["stack", "superapp", "--config", join(dir, "opencode.json")], { env: { PATH: dirname(process.execPath) } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /uvx {2}needed by: fetch, time/);
  assert.doesNotMatch(r.stdout, /- npx /);
});

test("--global creates ~/.config/opencode/opencode.json on a fresh machine", () => {
  const home = tmp();
  const r = run(["add", "memory", "--global"], { env: { HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 0, r.stderr);
  const cfgPath = join(home, ".config", "opencode", "opencode.json");
  assert.ok(existsSync(cfgPath), `expected ${cfgPath}`);
  assert.deepEqual(Object.keys(readJson(cfgPath).mcp), ["memory"]);
});

test("unknown ids / stacks fail without writing anything", () => {
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  const badId = run(["add", "definitely-not-a-server", "--config", cfgPath]);
  assert.equal(badId.status, 1);
  assert.match(badId.stderr, /Unknown id/);
  const badStack = run(["stack", "nope", "--config", cfgPath]);
  assert.equal(badStack.status, 1);
  assert.match(badStack.stderr, /Unknown stack/);
  assert.equal(run(["add", "--config", cfgPath]).status, 1);
  assert.ok(!existsSync(cfgPath));
});

test("an invalid existing config is reported and left untouched", () => {
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  writeFileSync(cfgPath, "{ not json");
  const r = run(["add", "memory", "--config", cfgPath]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid JSON/);
  assert.equal(readFileSync(cfgPath, "utf8"), "{ not json");
});

test("flag parsing: --config value vs ids, flags before the stack name, missing values", () => {
  const dir = tmp();
  // an id that happens to equal the --config value must still be installed
  const r = run(["add", "memory", "time", "--config", "time"], { cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(readJson(join(dir, "time")).mcp), ["memory", "time"]);
  const s = run(["stack", "--config", join(dir, "s.json"), "superapp"]);
  assert.equal(s.status, 0, s.stderr);
  assert.deepEqual(Object.keys(readJson(join(dir, "s.json")).mcp), stackIds("superapp"));
  const noVal = run(["add", "memory", "--config"]);
  assert.equal(noVal.status, 1);
  assert.match(noVal.stderr, /--config needs a file path/);
  assert.doesNotMatch(noVal.stderr, /^\s+at /m);
  writeFileSync(join(dir, "null.json"), "null");
  const nul = run(["add", "memory", "--config", join(dir, "null.json")]);
  assert.equal(nul.status, 1);
  assert.match(nul.stderr, /must contain a JSON object/);
  assert.equal(readFileSync(join(dir, "null.json"), "utf8"), "null");
  assert.equal(run(["list", "--stack", "nope"]).status, 1);
  assert.equal(run(["list", "--type", "bad"]).status, 1);
  // multi-word queries match the whole phrase, not just the first word
  const phrase = run(["search", "web", "search"]);
  assert.equal(phrase.status, 0);
  assert.ok(phrase.stdout.split("\n== ").length < run(["search", "web"]).stdout.split("\n== ").length);
});

test("defaults to ./opencode.json in the current directory", () => {
  const dir = tmp();
  const r = run(["add", "time"], { cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(readJson(join(dir, "opencode.json")).mcp), ["time"]);
});

test("no command prints usage and exits 1", () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /opencode MCP manager/);
});

const hasBash = process.platform !== "win32" && spawnSync("bash", ["--version"]).status === 0;
test("install.sh wraps the manager (list / stack / add / validate / bad flag)", { skip: !hasBash && "bash not available" }, () => {
  const sh = (...a) => spawnSync("bash", [join(KIT, "install.sh"), ...a], { encoding: "utf8" });
  // the README runs ./install.sh directly, so the executable bit must be set
  const direct = spawnSync(join(KIT, "install.sh"), ["--list"], { encoding: "utf8" });
  assert.equal(direct.status, 0, `./install.sh not executable? ${direct.error?.code || direct.stderr}`);
  const list = sh("--list");
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, new RegExp(`${N} MCP servers`));
  const dir = tmp();
  const cfgPath = join(dir, "opencode.json");
  assert.equal(sh("--superapp", "--config", cfgPath).status, 0);
  assert.equal(sh("--add", "github", "--config", cfgPath).status, 0);
  assert.deepEqual(Object.keys(readJson(cfgPath).mcp), [...stackIds("superapp"), "github"]);
  assert.equal(sh("--validate").status, 0);
  assert.equal(sh("--bogus").status, 1);
});

const hasPwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"]).status === 0;
test("install.ps1 wraps the manager and propagates its exit code", { skip: !hasPwsh && "pwsh not available" }, () => {
  const dir = tmp(); // install.ps1 has no -Config; it writes ./opencode.json in the cwd
  const ps = (...a) => spawnSync("pwsh", ["-NoProfile", "-File", join(KIT, "install.ps1"), ...a], { cwd: dir, encoding: "utf8" });
  const list = ps("-List");
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, new RegExp(`${N} MCP servers`));
  assert.equal(ps("-Superapp").status, 0);
  const add = ps("-Add", "github,sentry");
  assert.equal(add.status, 0, add.stdout + add.stderr);
  assert.deepEqual(Object.keys(readJson(join(dir, "opencode.json")).mcp), [...stackIds("superapp"), "github", "sentry"]);
  assert.equal(ps("-Stack", "nope").status, 1);
  assert.equal(ps("-Validate").status, 0);
  const cfgPath = join(tmp(), "custom.json");
  assert.equal(ps("-Stack", "testing", "-Config", cfgPath).status, 0);
  assert.deepEqual(Object.keys(readJson(cfgPath).mcp), stackIds("testing"));
});

test("install.ps1 is pure ASCII (Windows PowerShell 5.1 reads BOM-less scripts as ANSI)", () => {
  const bytes = readFileSync(join(KIT, "install.ps1"));
  const bad = bytes.findIndex((b) => b > 0x7f);
  assert.equal(bad, -1, `non-ASCII byte at offset ${bad}`);
});
