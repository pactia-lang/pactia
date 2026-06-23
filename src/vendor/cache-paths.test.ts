import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  globalPackageCacheDir,
  packageSearchRoots,
  versionIndexCachePath,
  workspaceVendorDir,
} from "./cache-paths.js";

describe("cache-paths", () => {
  it("encodes version index cache paths", () => {
    assert.match(
      versionIndexCachePath("@github.com/acme/fleet-rules"),
      /@github\.com--acme--fleet-rules\/versions\.json$/,
    );
  });

  it("honors package and version cache overrides", () => {
    const packagesDir = mkdtempSync(join(tmpdir(), "pactia-pkg-cache-"));
    const versionDir = mkdtempSync(join(tmpdir(), "pactia-ver-cache-"));
    const previousPackages = process.env["PACTIA_PACKAGES_DIR"];
    const previousVersions = process.env["PACTIA_VERSION_CACHE_DIR"];
    process.env["PACTIA_PACKAGES_DIR"] = packagesDir;
    process.env["PACTIA_VERSION_CACHE_DIR"] = versionDir;

    try {
      assert.equal(globalPackageCacheDir(), packagesDir);
      assert.ok(versionIndexCachePath("@pactia/kernel").startsWith(versionDir));
    } finally {
      if (previousPackages === undefined) delete process.env["PACTIA_PACKAGES_DIR"];
      else process.env["PACTIA_PACKAGES_DIR"] = previousPackages;
      if (previousVersions === undefined) delete process.env["PACTIA_VERSION_CACHE_DIR"];
      else process.env["PACTIA_VERSION_CACHE_DIR"] = previousVersions;
      rmSync(packagesDir, { recursive: true, force: true });
      rmSync(versionDir, { recursive: true, force: true });
    }
  });

  it("includes vendor env root in search paths", () => {
    const workspace = mkdtempSync(join(tmpdir(), "pactia-search-"));
    const vendorRoot = mkdtempSync(join(tmpdir(), "pactia-vendor-root-"));
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = vendorRoot;

    try {
      const roots = packageSearchRoots(workspace);
      assert.ok(roots.includes(workspaceVendorDir(workspace)));
      assert.ok(roots.includes(vendorRoot));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
      rmSync(vendorRoot, { recursive: true, force: true });
    }
  });
});
