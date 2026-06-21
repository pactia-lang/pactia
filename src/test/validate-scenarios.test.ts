import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectServiceIr } from "./collect-scenarios.js";
import { validateScenarios } from "./validate-scenarios.js";
import { TestVerdict } from "./test-types.js";
import type { ServiceIrSlice } from "./collect-scenarios.js";

const relayOrderSlice: ServiceIrSlice = {
  filePath: "/tmp/order.service.json",
  serviceName: "OrderService",
  apis: [
    { method: "GET", path: "/api/v1/orders", id: "list_orders" },
    { method: "POST", path: "/api/v1/orders", id: "create_order" },
  ],
  scenarios: [
    {
      serviceFile: "/tmp/order.service.json",
      serviceName: "OrderService",
      id: "operator_creates_order",
      name: "Operator creates an order",
      when: "Operator is logged in and POST /api/v1/orders with valid body",
      then: "status is 201 and order.created is emitted",
    },
    {
      serviceFile: "/tmp/order.service.json",
      serviceName: "OrderService",
      id: "unauthorized_create",
      name: "Unauthorized create rejected",
      when: "Anonymous POST /api/v1/orders",
      then: "status is 403",
    },
  ],
};

describe("validateScenarios", () => {
  it("passes scenarios that match declared APIs and include HTTP status", () => {
    const summary = validateScenarios([relayOrderSlice]);
    assert.equal(summary.total, 2);
    assert.equal(summary.failed, 0);
    assert.equal(summary.passed, 2);
    assert.ok(summary.checks.every((check) => check.verdict === TestVerdict.Pass));
  });

  it("fails when when-clause references an undeclared API", () => {
    const summary = validateScenarios([
      {
        ...relayOrderSlice,
        scenarios: [
          {
            ...relayOrderSlice.scenarios[0]!,
            when: "Operator is logged in and DELETE /api/v1/orders/1",
          },
        ],
      },
    ]);
    assert.equal(summary.failed, 1);
    assert.match(summary.checks[0]!.issue?.message ?? "", /No @api matches/);
  });

  it("fails when then-clause omits HTTP status", () => {
    const summary = validateScenarios([
      {
        ...relayOrderSlice,
        scenarios: [
          {
            ...relayOrderSlice.scenarios[0]!,
            then: "order.created is emitted",
          },
        ],
      },
    ]);
    assert.equal(summary.failed, 1);
    assert.match(summary.checks[0]!.issue?.message ?? "", /HTTP status/);
  });
});

describe("collectServiceIr", () => {
  it("returns no slices when output dir has no service IR", () => {
    assert.deepEqual(collectServiceIr("/nonexistent"), []);
  });
});
