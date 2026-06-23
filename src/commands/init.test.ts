import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { runAdd } from "./add.js";
import { runInit } from "./init.js";

const pactiacPackages = resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "pactiac",
  "test",
  "fixtures",
  "packages",
);

describe("runInit", () => {
  it("creates minimal workspace files without lock or stack deps", () => {
    const parent = mkdtempSync(join(tmpdir(), "pactia-init-"));

    try {
      const workspace = join(parent, "demo-product");
      const result = runInit({
        directory: workspace,
        name: "DemoProduct",
      });

      assert.equal(result.productName, "DemoProduct");
      assert.ok(existsSync(join(workspace, "pactia.toml")));
      assert.ok(existsSync(join(workspace, "product.pactia")));
      assert.equal(existsSync(join(workspace, "pactia.lock")), false);

      const product = readFileSync(join(workspace, "product.pactia"), "utf8");
      assert.match(product, /product DemoProduct/);
      assert.doesNotMatch(product, /#rust-stack/);
      assert.doesNotMatch(product, /import @pactia/);

      const toml = readFileSync(join(workspace, "pactia.toml"), "utf8");
      assert.doesNotMatch(toml, /\[dependencies\]\n"@pactia/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects init when workspace already exists", () => {
    const parent = mkdtempSync(join(tmpdir(), "pactia-init-dup-"));
    const workspace = join(parent, "demo");
    try {
      runInit({ directory: workspace });
      assert.throws(() => runInit({ directory: workspace }));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("runAdd", () => {
  it("adds a dependency, updates the lockfile, and vendors packages", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const parent = mkdtempSync(join(tmpdir(), "pactia-add-"));
    const workspace = join(parent, "demo");
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      runInit({ directory: workspace });

      const result = await runAdd({
        workspaceRoot: workspace,
        coordinate: "rust-stack",
        range: "^1.0",
      });

      assert.equal(result.coordinate, "@pactia/rust-stack");
      assert.match(readFileSync(join(workspace, "pactia.toml"), "utf8"), /"@pactia\/rust-stack"/);
      assert.ok(existsSync(join(workspace, "pactia.lock")));

      const lock = parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8"));
      assert.ok(lock.packages.some((entry) => entry.name === "@pactia/rust-stack"));

      const kernelDir = join(
        workspace,
        ".pactia",
        "packages",
        packageDirName("@pactia/kernel", "1.0.0"),
      );
      const stackDir = join(
        workspace,
        ".pactia",
        "packages",
        packageDirName("@pactia/rust-stack", "1.0.0"),
      );
      assert.ok(existsSync(join(kernelDir, "index.pactia")));
      assert.ok(existsSync(join(stackDir, "index.pactia")));
      assert.ok(result.vendoredPackages.includes("@pactia/rust-stack"));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
