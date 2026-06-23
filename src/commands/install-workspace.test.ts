import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { installWorkspacePackages } from "./install-workspace.js";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
import { serializeWorkspaceToml } from "../resolve/workspace-toml.js";

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

describe("installWorkspacePackages", () => {
  it("installs from lock without rewriting it", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-install-ws-"));
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
      const before = readFileSync(join(workspace, "pactia.lock"), "utf8");

      const result = await installWorkspacePackages(workspace);
      assert.equal(result.lockWritten, false);
      assert.equal(readFileSync(join(workspace, "pactia.lock"), "utf8"), before);
      assert.ok(result.vendoredPackages.length > 0);
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
