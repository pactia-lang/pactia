import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { installLockedPackages, resolveWorkspaceLock } from "./lock-resolver.js";
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
  it("writes pactia.lock with transitive kernel dependency", async () => {
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

      const result = await resolveWorkspaceLock(workspace);
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

describe("installLockedPackages", () => {
  it("errors when pactia.lock is missing", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "pactia-install-lock-"));
    try {
      writeFileSync(
        join(workspace, "pactia.toml"),
        serializeWorkspaceToml({
          name: "demo",
          version: "0.1.0",
          dependencies: new Map([["@pactia/kernel", "^1.0"]]),
        }),
      );

      await assert.rejects(
        () => installLockedPackages(workspace),
        (error: unknown) => {
          assert.ok(error instanceof ResolveError);
          assert.equal(error.code, ResolveErrorCode.LockMissing);
          return true;
        },
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("errors on digest mismatch", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-digest-"));
    const previousVendorRoot = process.env["PACTIA_VENDOR_ROOT"];
    process.env["PACTIA_VENDOR_ROOT"] = pactiacPackages;

    try {
      writeFileSync(
        join(workspace, "pactia.toml"),
        serializeWorkspaceToml({
          name: "demo",
          version: "0.1.0",
          dependencies: new Map([["@pactia/kernel", "^1.0"]]),
        }),
      );
      writeFileSync(
        join(workspace, "pactia.lock"),
        `lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"\n`,
      );

      await assert.rejects(
        () => installLockedPackages(workspace),
        (error: unknown) => {
          assert.ok(error instanceof ResolveError);
          assert.equal(error.code, ResolveErrorCode.LockDigestMismatch);
          return true;
        },
      );
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("does not rewrite pactia.lock", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-lock-truth-"));
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
      await resolveWorkspaceLock(workspace);
      const before = readFileSync(join(workspace, "pactia.lock"), "utf8");

      const result = await installLockedPackages(workspace);
      assert.equal(result.written, false);
      assert.equal(readFileSync(join(workspace, "pactia.lock"), "utf8"), before);
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
