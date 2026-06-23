import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePactiaLock } from "@pactia/pactiac";
import { buildContextArtifacts } from "./build-context-artifacts.js";

describe("buildContextArtifacts", () => {
  it("writes context.index.json and bundles workspace context files", () => {
    const workspace = mkdtempSync(join(tmpdir(), "pactia-context-"));
    const outputDir = join(workspace, "out");
    mkdirSync(join(workspace, "docs"), { recursive: true });
    writeFileSync(join(workspace, "docs", "api.md"), "# API\n", "utf8");
    mkdirSync(join(outputDir, "input"), { recursive: true });
    writeFileSync(
      join(outputDir, "input", "product.json"),
      JSON.stringify({
        product: {
          name: "Demo",
          context: [
            {
              id: "api_notes",
              path: "./docs/api.md",
              provenance: "Pactia",
            },
          ],
        },
      }),
      "utf8",
    );

    const lock = parsePactiaLock('lockVersion = 1\n\n[[package]]\nname = "@pactia/kernel"\nversion = "1.0.0"\ndigest = "sha256:abc"\n');
    const result = buildContextArtifacts({
      workspaceRoot: workspace,
      outputDir,
      lock,
      bundleContext: true,
    });

    assert.equal(result.indexPath, "input/context.index.json");
    assert.ok(existsSync(join(outputDir, "input", "context.index.json")));
    const index = JSON.parse(readFileSync(join(outputDir, "input", "context.index.json"), "utf8")) as {
      entries: Array<{ id: string; files: Array<{ digest: string }> }>;
    };
    assert.equal(index.entries[0]?.id, "api_notes");
    assert.match(index.entries[0]?.files[0]?.digest ?? "", /^sha256:/);
    assert.ok(existsSync(join(outputDir, "input", "context", "docs", "api.md")));

    rmSync(workspace, { recursive: true, force: true });
  });
});
