import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { runWhy } from "./why.js";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
import { serializeWorkspaceToml } from "../resolve/workspace-toml.js";

const packageRoot = resolve(import.meta.dirname, "..", "..");
const pactiacPackages = join(packageRoot, "..", "pactiac", "test", "fixtures", "packages");

describe("runWhy", () => {
  it("prints dependency chain for a locked package", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-why-cmd-"));
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      writeFileSync(
        join(workspace, "pactia.toml"),
        serializeWorkspaceToml({
          name: "demo",
          version: "0.1.0",
          dependencies: new Map([["@pactia/rust-stack", "^1.0"]]),
        }),
      );
      writeFileSync(join(workspace, "product.pactia"), "pactia 1.0\n\nproduct Demo {}\n", "utf8");
      await resolveWorkspaceLock(workspace);

      const result = await runWhy({
        workspaceRoot: workspace,
        coordinate: "@pactia/kernel",
      });
      assert.match(result.output, /@pactia\/kernel 1\.0\.0/);
      assert.match(result.output, /@pactia\/rust-stack 1\.0\.0/);
      assert.match(result.output, /demo \(workspace\)/);
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("pactia cli commands", () => {
  it("prints version and help", () => {
    const cliPath = resolve(packageRoot, "dist/cli.js");
    const version = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });
    assert.equal(version.status, 0);
    assert.match(version.stdout, /^pactia \d/);

    const help = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stderr, /pactia why/);
    assert.match(help.stderr, /publish --dry-run/);
  });
});
