import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { runPublish, validatePublishPackage, PublishValidationCode, PublishError } from "./publish.js";

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

  it("rejects dry-run with validation errors", () => {
    const tmp = join(tmpdir(), `pactia-test-publish-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      // No index.pactia — validation will fail
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      assert.throws(
        () => runPublish({ dryRun: true, packageRoot: tmp }),
        PublishError,
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
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

describe("body resolution", () => {
  it("rejects import without matching dependency", () => {
    const tmp = join(tmpdir(), `pactia-test-body-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nimport @pactia/kernel;\nexport def @test in product { }\n', "utf8");
      const result = validatePublishPackage(tmp);
      assert.ok(result.issues.some((i) => i.code === PublishValidationCode.PackageImportUnresolved));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("skips body resolution when no imports present", () => {
    const tmp = join(tmpdir(), `pactia-test-body-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n', "utf8");
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nexport def @test in product { }\n', "utf8");
      const result = validatePublishPackage(tmp);
      assert.equal(result.ok, true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("validates with vendored deps when available", () => {
    const tmp = join(tmpdir(), `pactia-test-body-${Date.now()}`);
    const vendorDir = join(tmp, ".pactia", "packages", "@pactia--kernel@1.0.0");
    mkdirSync(vendorDir, { recursive: true });
    writeFileSync(join(vendorDir, "pactia.toml"), '[package]\nname = "@pactia/kernel"\nversion = "1.0.0"\n');
    writeFileSync(join(vendorDir, "index.pactia"), "pactia 1.0\nexport def @stack in product { }\n");
    writeFileSync(join(vendorDir, ".digest"), "sha256:abc");

    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n', "utf8");
      writeFileSync(join(tmp, "pactia.lock"), 'lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:abc"\n');
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nimport @pactia/kernel;\nexport def #example in product { @stack { } }\n', "utf8");
      const result = validatePublishPackage(tmp);
      const hasUnresolved = result.issues.some((i) => i.code === PublishValidationCode.SymbolUnresolved);
      assert.equal(hasUnresolved, false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("catches unresolved tags in export def body", () => {
    const tmp = join(tmpdir(), `pactia-test-body-${Date.now()}`);
    const vendorDir = join(tmp, ".pactia", "packages", "@pactia--kernel@1.0.0");
    mkdirSync(vendorDir, { recursive: true });
    writeFileSync(join(vendorDir, "pactia.toml"), '[package]\nname = "@pactia/kernel"\nversion = "1.0.0"\n');
    writeFileSync(join(vendorDir, "index.pactia"), "pactia 1.0\nexport def @known_tag in product { }\n");
    writeFileSync(join(vendorDir, ".digest"), "sha256:abc");

    try {
      writeFileSync(join(tmp, "pactia.toml"), '[package]\nname = "@test/pkg"\nversion = "1.0.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n', "utf8");
      writeFileSync(join(tmp, "pactia.lock"), 'lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:abc"\n');
      // @unknown_tag is NOT exported by kernel
      writeFileSync(join(tmp, "index.pactia"), 'pactia 1.0\nimport @pactia/kernel;\nexport def #example in product { @unknown_tag { } }\n', "utf8");
      const result = validatePublishPackage(tmp);
      assert.ok(result.issues.some((i) => i.code === PublishValidationCode.SymbolUnresolved));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
