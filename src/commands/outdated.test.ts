import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runOutdated, compareSemver } from "./outdated.js";

test("runOutdated reports packages from lock file", async () => {
  const tmp = join(tmpdir(), `pactia-test-outdated-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  // Create minimal pactia.toml + pactia.lock
  writeFileSync(
    join(tmp, "pactia.toml"),
    [
      "[package]",
      'name = "test-product"',
      'version = "1.0.0"',
      "",
      "[dependencies]",
      '"@pactia/kernel" = "^1.0"',
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(tmp, "pactia.lock"),
    [
      "lockVersion = 1",
      "",
      "[[package]]",
      'name = "@pactia/kernel"',
      'version = "1.0.0"',
      'digest = "sha256:abc123def456"',
    ].join("\n"),
    "utf8",
  );

  try {
    const result = await runOutdated({ workspaceRoot: tmp });
    // Without a valid config, listRemoteVersions fails → "could not check"
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.coordinate, "@pactia/kernel");
    assert.equal(result.entries[0]?.current, "1.0.0");
    assert.equal(result.entries[0]?.latest, undefined);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runOutdated returns empty for no packages", async () => {
  const tmp = join(tmpdir(), `pactia-test-outdated-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  // Lock with one up-to-date package
  writeFileSync(
    join(tmp, "pactia.lock"),
    [
      "lockVersion = 1",
      "",
      "[[package]]",
      'name = "@pactia/kernel"',
      'version = "99.0.0"',
      'digest = "sha256:abc"',
    ].join("\n"),
    "utf8",
  );

  try {
    const result = await runOutdated({ workspaceRoot: tmp });
    // 99.0.0 is probably latest → no newer version → no latest field
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.latest, undefined);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runOutdated handles invalid semver gracefully", async () => {
  const tmp = join(tmpdir(), `pactia-test-outdated-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  writeFileSync(
    join(tmp, "pactia.toml"),
    "[package]\nname = \"test\"\nversion = \"1.0.0\"\n",
    "utf8",
  );
  writeFileSync(
    join(tmp, "pactia.lock"),
    [
      "lockVersion = 1",
      "",
      "[[package]]",
      'name = "@pactia/kernel"',
      'version = "not-semver"',
      'digest = "sha256:abc"',
    ].join("\n"),
    "utf8",
  );

  try {
    const result = await runOutdated({ workspaceRoot: tmp });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.current, "not-semver");
    assert.equal(result.entries[0]?.latest, undefined);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("compareSemver compares major versions", () => {
  assert.equal(compareSemver({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 }), -1);
  assert.equal(compareSemver({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 }), 1);
  assert.equal(compareSemver({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 }), 0);
});

test("compareSemver compares minor versions", () => {
  assert.equal(compareSemver({ major: 1, minor: 1, patch: 0 }, { major: 1, minor: 2, patch: 0 }), -1);
  assert.equal(compareSemver({ major: 1, minor: 2, patch: 0 }, { major: 1, minor: 1, patch: 0 }), 1);
});

test("compareSemver compares patch versions", () => {
  assert.equal(compareSemver({ major: 1, minor: 0, patch: 1 }, { major: 1, minor: 0, patch: 2 }), -1);
  assert.equal(compareSemver({ major: 1, minor: 0, patch: 2 }, { major: 1, minor: 0, patch: 1 }), 1);
});

