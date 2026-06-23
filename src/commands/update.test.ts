import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { runUpdate } from "./update.js";
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

describe("runUpdate", () => {
  it("refreshes the lockfile and vendors packages", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-update-"));
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

      const result = await runUpdate({ workspaceRoot: workspace });
      assert.equal(result.lockWritten, true);
      assert.ok(existsSync(join(workspace, "pactia.lock")));

      const lock = parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8"));
      assert.ok(lock.packages.some((entry) => entry.name === "@pactia/rust-stack"));
      assert.ok(result.vendoredPackages.includes("@pactia/rust-stack"));
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
