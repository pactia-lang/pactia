import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { writeCompileOutput } from "./write-output.js";

describe("writeCompileOutput", () => {
  it("writes nested compile files under the output directory", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "pactia-out-"));
    try {
      const written = writeCompileOutput(
        new Map([
          ["input/product.json", "{\"product\":{}}"],
          ["input/modules/core.module.json", "{}"],
        ]),
        outputDir,
      );
      assert.deepEqual(written.sort(), [
        "input/modules/core.module.json",
        "input/product.json",
      ]);
      assert.equal(
        readFileSync(join(outputDir, "input/product.json"), "utf8"),
        "{\"product\":{}}",
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
