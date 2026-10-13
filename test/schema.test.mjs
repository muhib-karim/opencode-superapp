import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../scripts/lib/schema.mjs";
import { loadRegistry, loadSchema } from "../scripts/lib/registry.mjs";

const schema = loadSchema();
const local = {
  id: "demo", title: "Demo", description: "d", type: "local", category: "Core", stacks: ["web-dev"],
  command: ["npx", "demo"], envVars: [], toolsPrefix: "demo_*", install: "npx demo",
};

test("real registry.json conforms to schema/registry.schema.json", () => {
  assert.deepEqual(validateSchema(loadRegistry(), schema), []);
});

test("valid minimal entry passes", () => {
  assert.deepEqual(validateSchema([local], schema), []);
});

test("missing required field is reported", () => {
  const { title, ...noTitle } = local;
  assert.match(validateSchema([noTitle], schema).join("\n"), /missing required "title"/);
});

test("bad enum, pattern and unexpected property are reported", () => {
  const errs = validateSchema([{ ...local, type: "stdio", id: "Bad ID", extra: 1 }], schema).join("\n");
  assert.match(errs, /\$\[0\]\.type: "stdio" not in/);
  assert.match(errs, /\$\[0\]\.id: does not match/);
  assert.match(errs, /unexpected property "extra"/);
});

test("wrong types are reported with a path", () => {
  const errs = validateSchema([{ ...local, command: "npx demo", envVars: [{ name: "lower", required: "yes", desc: "" }] }], schema);
  assert.ok(errs.includes("$[0].command: expected array, got string"));
  assert.ok(errs.some((e) => e.startsWith("$[0].envVars[0].name: does not match")));
  assert.ok(errs.includes("$[0].envVars[0].required: expected boolean, got string"));
});

test("remote url must be https and oauth may be boolean or object", () => {
  const remote = { ...local, type: "remote", command: undefined, url: "http://x", oauth: {} };
  delete remote.command;
  assert.match(validateSchema([remote], schema).join(), /url: does not match/);
  assert.deepEqual(validateSchema([{ ...remote, url: "https://x", oauth: false }], schema), []);
  assert.match(validateSchema([{ ...remote, url: "https://x", oauth: "yes" }], schema).join(), /oauth: expected boolean\|object/);
});
