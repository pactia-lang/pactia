import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bundleContextPath, bundleContextPathValue } from "./bundle-context-path.js";

describe("bundleContextPath", () => {
  it("maps workspace-relative file paths", () => {
    assert.equal(bundleContextPath("./docs/api.md"), "context/docs/api.md");
  });

  it("maps directory paths with trailing slash", () => {
    assert.equal(bundleContextPath("./assets/runbooks/"), "context/assets/runbooks/");
  });

  it("maps path arrays", () => {
    assert.deepEqual(bundleContextPathValue(["./a.md", "./b.png"]), [
      "context/a.md",
      "context/b.png",
    ]);
  });
});
