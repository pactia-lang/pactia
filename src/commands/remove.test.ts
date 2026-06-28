import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runRemove, RemoveError } from "./remove.js";

test("runRemove removes a dependency from pactia.toml", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(
    join(tmp, "pactia.toml"),
    '[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n"@pactia/rust-stack" = "^1.0"\n',
  );

  try {
    const result = runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" });
    assert.equal(result.removed, true);
    assert.equal(result.coordinate, "@pactia/kernel");

    const content = readFileSync(join(tmp, "pactia.toml"), "utf8");
    assert.ok(!content.includes("@pactia/kernel"));
    assert.ok(content.includes("@pactia/rust-stack"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runRemove removes the entry from pactia.lock", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(
    join(tmp, "pactia.toml"),
    '[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n',
  );
  writeFileSync(
    join(tmp, "pactia.lock"),
    'lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:aaa"\n\n[[package]]\nname = "@pactia/rust-stack"\nversion = "1.0.0"\ndigest = "sha256:bbb"\n',
  );

  try {
    const result = runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" });
    assert.equal(result.removed, true);

    const lockContent = readFileSync(join(tmp, "pactia.lock"), "utf8");
    assert.ok(!lockContent.includes("@pactia/kernel"));
    assert.ok(lockContent.includes("@pactia/rust-stack"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runRemove warns about transitive dependents", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  const vendorDir = join(tmp, ".pactia", "packages");
  mkdirSync(vendorDir, { recursive: true });

  // Create a vendored package that imports the removed coordinate
  const wrapperDir = join(vendorDir, "@test--wrapper@1.0.0");
  mkdirSync(wrapperDir, { recursive: true });
  writeFileSync(join(wrapperDir, "index.pactia"), "pactia 1.0\nimport @pactia/kernel;\n");

  writeFileSync(
    join(tmp, "pactia.toml"),
    '[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n"@test/wrapper" = "^1.0"\n',
  );

  try {
    const result = runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" });
    assert.equal(result.removed, true);
    assert.equal(result.transitiveDependents.length, 1);
    assert.ok(result.transitiveDependents[0]!.includes("wrapper"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runRemove cleans vendored package directory", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  const vendorDir = join(tmp, ".pactia", "packages", "@pactia--kernel@1.0.0");
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(join(vendorDir, "dummy"), "x");

  writeFileSync(
    join(tmp, "pactia.toml"),
    '[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n',
  );

  try {
    runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" });
    assert.ok(!existsSync(vendorDir));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runRemove returns removed=false when dep not found", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(
    join(tmp, "pactia.toml"),
    '[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/rust-stack" = "^1.0"\n',
  );

  try {
    const result = runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" });
    assert.equal(result.removed, false);
    assert.equal(result.transitiveDependents.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runRemove throws RemoveError when pactia.toml missing", () => {
  const tmp = join(tmpdir(), `pactia-test-remove-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  try {
    assert.throws(
      () => runRemove({ workspaceRoot: tmp, coordinate: "@pactia/kernel" }),
      RemoveError,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
