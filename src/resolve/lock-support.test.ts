import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildPackageIndex, readPackageDependencies } from "./lock-support.js";

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

describe("lock-support", () => {
  it("reads package dependencies from vendored tree", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }
    const deps = readPackageDependencies(kernelPackage);
    assert.equal(deps.size, 0);
  });

  it("builds index from PACTIA_VENDOR_ROOT", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = join(kernelPackage, "..");
    try {
      const index = buildPackageIndex("/tmp/unused-workspace");
      assert.ok(index.some((entry) => entry.coordinate === "@pactia/kernel"));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
    }
  });
});
