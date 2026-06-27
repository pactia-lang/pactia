import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runClean } from "./clean.js";

test("runClean removes .pactia and out directories", () => {
  const tmp = join(tmpdir(), `pactia-test-clean-${Date.now()}`);
  const vendorDir = join(tmp, ".pactia");
  const outDir = join(tmp, "out");
  mkdirSync(vendorDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(vendorDir, "dummy"), "x");
  writeFileSync(join(outDir, "dummy"), "x");

  try {
    const result = runClean({ workspaceRoot: tmp });
    assert.equal(result.removed.length, 2);
    assert.ok(!existsSync(vendorDir));
    assert.ok(!existsSync(outDir));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runClean removes custom output directory", () => {
  const tmp = join(tmpdir(), `pactia-test-clean-${Date.now()}`);
  const buildDir = join(tmp, "build");
  mkdirSync(buildDir, { recursive: true });

  try {
    const result = runClean({ workspaceRoot: tmp, outputDir: "build" });
    assert.equal(result.removed.length, 1);
    assert.ok(!existsSync(buildDir));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runClean reports nothing to clean for empty dir", () => {
  const tmp = join(tmpdir(), `pactia-test-clean-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  try {
    const result = runClean({ workspaceRoot: tmp });
    assert.equal(result.removed.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runClean wraps WorkspaceError as CleanError", () => {
  // Call without workspaceRoot in a temp dir that has no pactia.lock
  const tmp = join(tmpdir(), `pactia-test-clean-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const cwd = process.cwd();
  try {
    process.chdir(tmp);
    assert.throws(
      () => runClean(),
      (err: unknown) => err instanceof Error && err.name === "CleanError",
    );
  } finally {
    process.chdir(cwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

