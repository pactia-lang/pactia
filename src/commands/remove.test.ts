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

    // Verify the toml no longer has kernel
    const content = readFileSync(join(tmp, "pactia.toml"), "utf8");
    assert.ok(!content.includes("@pactia/kernel"));
    assert.ok(content.includes("@pactia/rust-stack"));
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
