import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import {
  buildLockDependencyGraph,
  dependencyChainToTarget,
  formatWhyChain,
} from "./dependency-graph.js";
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

describe("dependencyChainToTarget", () => {
  it("traces transitive dependencies from the workspace", async () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "pactia-why-graph-"));
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
      const lock = parsePactiaLock(readFileSync(join(workspace, "pactia.lock"), "utf8"));
      const graph = buildLockDependencyGraph(workspace, lock);
      const chain = dependencyChainToTarget(graph, "@pactia/kernel");

      assert.deepEqual(chain, ["@pactia/rust-stack", "@pactia/kernel"]);
      assert.match(
        formatWhyChain(graph, chain!),
        /@pactia\/kernel 1\.0\.0/,
      );
      assert.match(formatWhyChain(graph, chain!), /demo \(workspace\)/);
    } finally {
      if (previousVendorRoot === undefined) delete process.env["PACTIA_VENDOR_ROOT"];
      else process.env["PACTIA_VENDOR_ROOT"] = previousVendorRoot;
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
