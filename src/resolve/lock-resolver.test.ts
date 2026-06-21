import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { resolveWorkspaceLock } from "./lock-resolver.js";
import { serializeWorkspaceToml } from "./workspace-toml.js";

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

describe("resolveWorkspaceLock", () => {
  it("writes pactia.lock with transitive kernel dependency", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-lock-"));
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
      writeFileSync(
        join(workspace, "product.pactia"),
        "pactia 1.0\n\nproduct Demo {\n  module core {\n    service ApiService {\n      @api ping { method: GET, path: \"/ping\", }\n    }\n  }\n}\n",
      );

      const result = resolveWorkspaceLock(workspace);
      assert.equal(result.written, true);
      assert.ok(existsSync(join(workspace, "pactia.lock")));

      const lock = parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8"));
      const names = lock.packages.map((entry) => entry.name).sort();
      assert.deepEqual(names, ["@pactia/kernel", "@pactia/rust-stack"]);
      for (const entry of lock.packages) {
        assert.match(entry.digest, /^sha256:[0-9a-f]{64}$/);
      }
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
