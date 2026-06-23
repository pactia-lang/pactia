import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { materializePackageCache, packageDigest } from "./install-package.js";
import { packageDirName } from "../domain/package-coordinate.js";

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

describe("materializePackageCache", () => {
  it("copies a local package tree into the global cache", async () => {
    if (!existsSync(kernelPackage)) {
      return;
    }

    const cacheRoot = mkdtempSync(join(tmpdir(), "pactia-materialize-"));
    const previousCache = process.env["PACTIA_PACKAGES_DIR"];
    process.env["PACTIA_PACKAGES_DIR"] = cacheRoot;

    try {
      const cacheDir = await materializePackageCache(
        "@pactia/kernel",
        "1.0.0",
        kernelPackage,
      );
      assert.equal(
        cacheDir,
        join(cacheRoot, packageDirName("@pactia/kernel", "1.0.0")),
      );
      assert.ok(existsSync(join(cacheDir, "pactia.toml")));
      assert.ok(existsSync(join(cacheDir, "index.pactia")));

      const again = await materializePackageCache(
        "@pactia/kernel",
        "1.0.0",
        kernelPackage,
      );
      assert.equal(again, cacheDir);
    } finally {
      if (previousCache === undefined) delete process.env["PACTIA_PACKAGES_DIR"];
      else process.env["PACTIA_PACKAGES_DIR"] = previousCache;
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});

describe("packageDigest", () => {
  it("reads digest marker from fixture package", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }
    assert.match(packageDigest(kernelPackage), /^sha256:[0-9a-f]{64}$/);
  });
});
