import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packageDirName } from "../domain/package-coordinate.js";

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
