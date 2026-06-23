import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { ensureVendoredPackages, VendorError } from "./ensure-vendored.js";

const pactiacPackages = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "pactiac",
  "test",
  "fixtures",
  "packages",
);

describe("ensureVendoredPackages", () => {
  it("copies missing packages from PACTIA_VENDOR_ROOT", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-vendor-"));
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      writeFileSync(join(workspace, "pactia.toml"), "[package]\nname = \"demo\"\n", "utf8");
      writeFileSync(join(workspace, "product.pactia"), "pactia 1.0\n\nproduct Demo {}\n", "utf8");
      writeFileSync(
        join(workspace, "pactia.lock"),
        `lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:abc"\n`,
      );

      const copied = ensureVendoredPackages(
        workspace,
        parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8")),
      );
      assert.deepEqual(copied, ["@pactia/kernel"]);
      assert.ok(
        existsSync(
          join(
            workspace,
            ".pactia",
            "packages",
            packageDirName("@pactia/kernel", "1.0.0"),
            "index.pactia",
          ),
        ),
      );
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("throws when locked package is unavailable", () => {
    const workspace = mkdtempSync(join(tmpdir(), "pactia-vendor-miss-"));
    try {
      assert.throws(
        () =>
          ensureVendoredPackages(workspace, {
            packages: [
              {
                name: "@pactia/missing",
                version: "9.9.9",
                digest: "sha256:000",
              },
            ],
          }),
        VendorError,
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
