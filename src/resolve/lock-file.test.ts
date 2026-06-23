import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializePactiaLock } from "./lock-file.js";

describe("serializePactiaLock", () => {
  it("sorts packages and writes lockVersion", () => {
    const serialized = serializePactiaLock({
      packages: [
        {
          name: "@pactia/rust-stack",
          version: "1.0.0",
          digest: "sha256:bbb",
        },
        {
          name: "@pactia/kernel",
          version: "1.0.0",
          digest: "sha256:aaa",
        },
      ],
    });
    assert.match(serialized, /^lockVersion = 1/);
    const kernelIndex = serialized.indexOf("@pactia/kernel");
    const stackIndex = serialized.indexOf("@pactia/rust-stack");
    assert.ok(kernelIndex < stackIndex);
    assert.match(serialized, /digest = "sha256:aaa"/);
  });
});
