import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { runBuild } from "./commands/build.js";
import { ensureVendoredPackages } from "./vendor/ensure-vendored.js";
import { packageDirName } from "./domain/package-coordinate.js";

const packageRoot = resolve(import.meta.dirname, "..");
const pactiacRoot = resolve(packageRoot, "..", "pactiac");
const pactiacPackages = join(pactiacRoot, "test", "fixtures", "packages");
const marketplaceRoot = resolve(packageRoot, "..", "examples", "marketplace");
const websiteRoot = join(pactiacRoot, "test", "fixtures", "workspace", "website");

describe("runBuild", () => {
  it("builds marketplace example when vendor packages are available", () => {
    if (!existsSync(marketplaceRoot) || !existsSync(pactiacPackages)) {
      return;
    }

    const outputDir = mkdtempSync(join(tmpdir(), "pactia-build-"));
    try {
      const result = runBuild({
        workspaceRoot: marketplaceRoot,
        outputDir,
      });

      assert.equal(result.workspaceRoot, resolve(marketplaceRoot));
      assert.ok(result.filesWritten.includes("input/product.json"));
      assert.ok(existsSync(join(outputDir, "input/product.json")));
      const product = JSON.parse(readFileSync(join(outputDir, "input/product.json"), "utf8")) as {
        product: { name?: string };
      };
      assert.equal(product.product.name, "Marketplace");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("builds pactia-lang-website example when vendor packages are available", () => {
    if (!existsSync(websiteRoot) || !existsSync(pactiacPackages)) {
      return;
    }

    const outputDir = mkdtempSync(join(tmpdir(), "pactia-website-build-"));
    try {
      const result = runBuild({
        workspaceRoot: websiteRoot,
        outputDir,
      });

      assert.equal(result.workspaceRoot, resolve(websiteRoot));
      assert.ok(result.filesWritten.includes("input/product.json"));
      assert.ok(existsSync(join(outputDir, "input/modules/marketing/services/site.service.json")));
      const product = JSON.parse(readFileSync(join(outputDir, "input/product.json"), "utf8")) as {
        product: { name?: string };
      };
      assert.equal(product.product.name, "PactiaLangWebsite");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("vendors locked packages into .pactia/packages when missing", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-vendor-"));
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;
    try {
      writeFileSync(
        join(workspace, "pactia.toml"),
        `[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n`,
      );
      writeFileSync(
        join(workspace, "pactia.lock"),
        `lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:abc"\n`,
      );
      writeFileSync(
        join(workspace, "product.pactia"),
        `pactia 1.0\n\nproduct Demo {\n  module billing {\n    service PingService {\n      @api ping {\n        method: GET,\n        path: "/ping",\n      }\n    }\n  }\n}\n`,
      );

      const kernelDir = join(pactiacPackages, packageDirName("@pactia/kernel", "1.0.0"));
      assert.ok(existsSync(kernelDir));

      const copied = ensureVendoredPackages(
        workspace,
        parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8")),
      );
      assert.deepEqual(copied, ["@pactia/kernel"]);

      const vendored = join(workspace, ".pactia", "packages", packageDirName("@pactia/kernel", "1.0.0"));
      assert.ok(existsSync(join(vendored, "pactia.toml")));
      assert.ok(existsSync(join(vendored, "index.pactia")));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("pactia cli", () => {
  it("runs build subcommand on marketplace", () => {
    if (!existsSync(marketplaceRoot) || !existsSync(pactiacPackages)) {
      return;
    }

    const cliPath = resolve(packageRoot, "dist/cli.js");
    const outputDir = mkdtempSync(join(tmpdir(), "pactia-cli-"));
    try {
      const result = spawnSync(
        process.execPath,
        [cliPath, "build", "-C", marketplaceRoot, "-o", outputDir],
        { encoding: "utf8" },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /wrote input\/product\.json/);
      assert.match(result.stdout, /Finished `build`/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
