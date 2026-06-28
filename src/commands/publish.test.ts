import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { runPublish, validatePublishPackage, PublishValidationCode } from "./publish.js";

const kernelPackage = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "pactiac",
  "test",
  "fixtures",
  "packages",
  "@pactia--kernel@1.0.0",
);

describe("validatePublishPackage", () => {
  it("accepts a valid package tree", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }

    const result = validatePublishPackage(kernelPackage);
    assert.equal(result.ok, true);
    assert.equal(result.name, "@pactia/kernel");
    assert.equal(result.version, "1.0.0");
  });

  it("rejects a package without index.pactia", () => {
    const result = validatePublishPackage(import.meta.dirname);
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0);
  });
});

describe("runPublish", () => {
  it("runs dry-run validation", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }

    const result = runPublish({ packageRoot: kernelPackage, dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.name, "@pactia/kernel");
  });

  it("rejects publish without --dry-run", () => {
    assert.throws(() => runPublish({ dryRun: false }));
  });

  it("works with -C <subdir> for monorepo slices", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    const subDir = join(tmp, "packages", "my-lib");
    mkdirSync(subDir, { recursive: true });
    try {
      writeFileSync(join(subDir, "pactia.toml"), '[package]\nname = "@test/my-lib"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(subDir, "index.pactia"), "pactia 1.0\n", "utf8");
      const result = runPublish({ dryRun: true, packageRoot: subDir });
      assert.equal(result.name, "@test/my-lib");
      assert.equal(result.ok, true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("topology validation", () => {
  it("rejects missing manifest files", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nexport "./missing.pactia"\n', "utf8");
      const result = validatePublishPackage(tmp);
      assert.ok(result.issues.some((i) => i.code === PublishValidationCode.ManifestFileMissing));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("warns on mixed exports without opt-in", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nexport def @api in service { }\nexport "./mod.pactia"\n', "utf8");
      writeFileSync(join(tmp, "mod.pactia"), "export module test { }", "utf8");
      const result = validatePublishPackage(tmp);
      assert.ok(result.issues.some((i) => i.code === PublishValidationCode.MixedExportsMissing));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts valid manifest files", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nexport "./mod.pactia"\n', "utf8");
      writeFileSync(join(tmp, "mod.pactia"), "export module test { }", "utf8");
      const result = validatePublishPackage(tmp);
      assert.equal(result.ok, true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects empty manifest files", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nexport "./empty.pactia"\n', "utf8");
      writeFileSync(join(tmp, "empty.pactia"), "", "utf8");
      const result = validatePublishPackage(tmp);
      assert.ok(result.issues.some((i) => i.code === PublishValidationCode.ManifestFileEmpty));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
