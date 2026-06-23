import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { packageDirName } from "../domain/package-coordinate.js";
import { scanPackageIndex } from "./package-index.js";

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

describe("package-index directory encoding", () => {
  it("round-trips Go-style coordinates in vendor dir names", () => {
    const coordinate = "@github.com/acme/fleet-rules";
    const dirName = packageDirName(coordinate, "1.0.0");
    assert.equal(dirName, "@github.com--acme--fleet-rules@1.0.0");

    const at = dirName.lastIndexOf("@");
    const decoded = dirName.slice(0, at).replace(/--/g, "/");
    assert.equal(decoded, coordinate);
  });
});

describe("scanPackageIndex", () => {
  it("indexes vendored fixture packages", () => {
    if (!existsSync(pactiacPackages)) {
      return;
    }

    const index = scanPackageIndex(pactiacPackages);
    const kernel = index.find((entry) => entry.coordinate === "@pactia/kernel");
    assert.ok(kernel);
    assert.equal(kernel.version, "1.0.0");
    assert.ok(kernel.rootDir.endsWith(packageDirName("@pactia/kernel", "1.0.0")));
  });
});
