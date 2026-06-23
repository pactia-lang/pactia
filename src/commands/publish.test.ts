import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runPublish, validatePublishPackage } from "./publish.js";

const kernelPackage = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "pactiac",
  "test",
  "fixtures",
  "packages",
  "@pactia--kernel@1.0.0",
);

describe("validatePublishPackage", () => {
  it("accepts a valid package tree", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }

    const result = validatePublishPackage(kernelPackage);
    assert.equal(result.ok, true);
    assert.equal(result.name, "@pactia/kernel");
    assert.equal(result.version, "1.0.0");
  });

  it("rejects a package without index.pactia", () => {
    const result = validatePublishPackage(import.meta.dirname);
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0);
  });
});

describe("runPublish", () => {
  it("runs dry-run validation", () => {
    if (!existsSync(kernelPackage)) {
      return;
    }

    const result = runPublish({ packageRoot: kernelPackage, dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.name, "@pactia/kernel");
  });

  it("rejects publish without --dry-run", () => {
    assert.throws(() => runPublish({ dryRun: false }));
  });
});
