import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteBundledContextInValue } from "./rewrite-bundled-context.js";

describe("rewriteBundledContextInValue", () => {
  it("rewrites context paths and drops package coordinates", () => {
    const input = {
      product: {
        context: [
          {
            id: "notes",
            path: "./docs/api.md",
            package: "@pactia/kernel",
          },
        ],
      },
    };

    const output = rewriteBundledContextInValue(input) as typeof input;
    assert.deepEqual(output.product.context[0], {
      id: "notes",
      path: "context/docs/api.md",
    });
  });

  it("rewrites nested context arrays in workspace bundles", () => {
    const input = {
      modules: [
        {
          module: {
            context: [{ id: "runbooks", path: ["./ops/a.md", "./ops/b.md"] }],
          },
        },
      ],
    };

    const output = rewriteBundledContextInValue(input) as typeof input;
    assert.deepEqual(output.modules[0]?.module.context[0]?.path, [
      "context/ops/a.md",
      "context/ops/b.md",
    ]);
  });
});
