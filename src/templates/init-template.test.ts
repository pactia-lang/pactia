import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMinimalProductPactia } from "./init-template.js";

describe("renderMinimalProductPactia", () => {
  it("renders minimal product scaffold with empty core module", () => {
    const source = renderMinimalProductPactia("DemoProduct");
    assert.match(source, /^pactia 1\.0/);
    assert.match(source, /product DemoProduct \{/);
    assert.match(source, /module core \{/);
    assert.doesNotMatch(source, /import @pactia/);
  });
});
