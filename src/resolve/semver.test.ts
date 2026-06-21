import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSemver, pickBestVersion, satisfiesSemver } from "./semver.js";

describe("satisfiesSemver", () => {
  it("matches exact versions", () => {
    assert.equal(satisfiesSemver("1.0.0", "1.0.0"), true);
    assert.equal(satisfiesSemver("1.0.1", "1.0.0"), false);
  });

  it("matches caret ranges", () => {
    assert.equal(satisfiesSemver("1.0.0", "^1.0"), true);
    assert.equal(satisfiesSemver("1.2.3", "^1.0"), true);
    assert.equal(satisfiesSemver("2.0.0", "^1.0"), false);
    assert.equal(satisfiesSemver("1.0.0", "^1.0.0"), true);
    assert.equal(satisfiesSemver("1.0.1", "^1.0.0"), true);
    assert.equal(satisfiesSemver("1.1.0", "^1.0.0"), true);
    assert.equal(satisfiesSemver("2.0.0", "^1.0.0"), false);
  });
});

describe("pickBestVersion", () => {
  it("picks the highest matching version", () => {
    const best = pickBestVersion(["1.0.0", "1.1.0", "2.0.0"], "^1.0");
    assert.equal(best, "1.1.0");
  });

  it("sorts semver tuples", () => {
    assert.ok(compareSemver("1.10.0", "1.2.0") > 0);
    assert.ok(compareSemver("1.2.0", "1.10.0") < 0);
  });
});
