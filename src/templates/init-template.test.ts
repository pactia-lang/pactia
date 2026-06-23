import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMinimalProductPactia } from "./init-template.js";

describe("renderMinimalProductPactia", () => {
  it("renders prose-only product scaffold", () => {
    const source = renderMinimalProductPactia("DemoProduct");
    assert.match(source, /^pactia 1\.0/);
    assert.match(source, /product DemoProduct \{/);
    assert.doesNotMatch(source, /import @pactia/);
  });
});
