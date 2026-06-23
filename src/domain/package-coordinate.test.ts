import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coordinateStyle,
  isValidCoordinate,
  normalizeCoordinate,
  PackageCoordinateStyle,
  packageDirName,
} from "./package-coordinate.js";
import { ResolveError } from "./resolve-error.js";

describe("package-coordinate", () => {
  it("accepts scope coordinates", () => {
    assert.equal(coordinateStyle("@pactia/kernel"), PackageCoordinateStyle.Scope);
    assert.ok(isValidCoordinate("@pactia/rust-stack"));
  });

  it("accepts Go-style host path coordinates", () => {
    assert.equal(
      coordinateStyle("@github.com/acme/fleet-rules"),
      PackageCoordinateStyle.HostPath,
    );
    assert.ok(isValidCoordinate("@gitlab.com/acme/fleet-rules"));
    assert.ok(isValidCoordinate("@git.example.com/acme/fleet-rules"));
  });

  it("rejects vague two-segment host paths", () => {
    assert.equal(isValidCoordinate("@github.com/fleet-rules"), false);
    assert.equal(isValidCoordinate("@github/package"), false);
    assert.equal(isValidCoordinate("@gitlab/package"), false);
  });

  it("normalizes short names to @pactia/", () => {
    assert.equal(normalizeCoordinate("rust-stack"), "@pactia/rust-stack");
    assert.equal(normalizeCoordinate("@github.com/acme/fleet-rules"), "@github.com/acme/fleet-rules");
  });

  it("rejects invalid coordinates", () => {
    assert.throws(() => normalizeCoordinate("@github/package"), ResolveError);
    assert.throws(() => normalizeCoordinate(""), ResolveError);
  });

  it("encodes vendor directory names with multi-segment coordinates", () => {
    assert.equal(
      packageDirName("@github.com/acme/fleet-rules", "1.0.0"),
      "@github.com--acme--fleet-rules@1.0.0",
    );
  });
});
