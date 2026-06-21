import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { runAdd } from "./add.js";
import { runInit, ProductStack } from "./init.js";

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
  it("creates workspace files and lock", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const parent = mkdtempSync(join(tmpdir(), "pactia-init-"));
    const workspace = join(parent, "demo-product");
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      const result = runInit({
        directory: workspace,
        name: "DemoProduct",
        stack: ProductStack.RustStack,
      });

      assert.equal(result.productName, "DemoProduct");
      assert.ok(existsSync(join(workspace, "pactia.toml")));
      assert.ok(existsSync(join(workspace, "product.pactia")));
      assert.ok(existsSync(join(workspace, "pactia.lock")));
      assert.match(readFileSync(join(workspace, "product.pactia"), "utf8"), /#rust-stack/);

      const lock = parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8"));
      assert.ok(lock.packages.some((entry) => entry.name === "@pactia/rust-stack"));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("runAdd", () => {
  it("adds a dependency and updates the lockfile", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const parent = mkdtempSync(join(tmpdir(), "pactia-add-"));
    const workspace = join(parent, "demo");
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      runInit({ directory: workspace, stack: ProductStack.RustStack });
      const lockBefore = readFileSync(join(workspace, "pactia.lock"), "utf8");

      const result = runAdd({
        workspaceRoot: workspace,
        coordinate: "html-css-js",
        range: "^1.0",
      });

      assert.equal(result.coordinate, "@pactia/html-css-js");
      assert.match(readFileSync(join(workspace, "pactia.toml"), "utf8"), /"@pactia\/html-css-js"/);
      const lockAfter = readFileSync(join(workspace, "pactia.lock"), "utf8");
      assert.notEqual(lockBefore, lockAfter);
      const lock = parsePactiaLock(lockAfter);
      assert.ok(lock.packages.some((entry) => entry.name === "@pactia/html-css-js"));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
