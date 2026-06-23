import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { findWorkspaceRoot, WorkspaceError } from "./find-workspace.js";

describe("findWorkspaceRoot", () => {
  it("finds pactia.toml and product.pactia in a child directory", () => {
    const root = mkdtempSync(join(tmpdir(), "pactia-ws-"));
    const nested = join(root, "apps", "demo");
    try {
      writeFileSync(join(root, "pactia.toml"), "[package]\nname = \"demo\"\n", "utf8");
      writeFileSync(join(root, "product.pactia"), "pactia 1.0\n\nproduct Demo {}\n", "utf8");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, ".keep"), "", "utf8");

      assert.equal(findWorkspaceRoot(nested), root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws when workspace files are missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "pactia-nows-"));
    try {
      assert.throws(() => findWorkspaceRoot(dir), WorkspaceError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
