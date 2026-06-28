import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseWorkspaceToml,
  serializeWorkspaceToml,
  upsertDependency,
  removeDependency,
} from "./workspace-toml.js";

describe("workspace-toml", () => {
  it("round-trips package metadata and dependencies", () => {
    const source = serializeWorkspaceToml({
      name: "marketplace",
      version: "0.1.0",
      dependencies: new Map([
        ["@pactia/kernel", "^1.0"],
        ["@pactia/rust-stack", "^1.0"],
      ]),
    });
    const parsed = parseWorkspaceToml(source);
    assert.equal(parsed.name, "marketplace");
    assert.equal(parsed.version, "0.1.0");
    assert.equal(parsed.dependencies.get("@pactia/kernel"), "^1.0");
    assert.equal(parsed.dependencies.get("@pactia/rust-stack"), "^1.0");
  });

  it("upserts a dependency into existing toml", () => {
    const source = `[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\n`;
    const next = upsertDependency(source, "@pactia/kernel", "^1.0");
    const parsed = parseWorkspaceToml(next);
    assert.equal(parsed.dependencies.get("@pactia/kernel"), "^1.0");
  });

  it("removes a dependency from toml", () => {
    const source = `[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/kernel" = "^1.0"\n"@pactia/rust-stack" = "^1.0"\n`;
    const next = removeDependency(source, "@pactia/kernel");
    const parsed = parseWorkspaceToml(next);
    assert.equal(parsed.dependencies.has("@pactia/kernel"), false);
    assert.equal(parsed.dependencies.get("@pactia/rust-stack"), "^1.0");
  });

  it("removeDependency is a no-op when dep not present", () => {
    const source = `[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\n"@pactia/rust-stack" = "^1.0"\n`;
    const next = removeDependency(source, "@pactia/kernel");
    assert.equal(next, source);
  });
});
