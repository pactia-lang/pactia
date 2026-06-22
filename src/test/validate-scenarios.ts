import { parseThenClause, parseWhenClause } from "@pactia/pactiac";
import type { ServiceIrSlice } from "./collect-scenarios.js";
import {
  TestIssueCode,
  TestVerdict,
  type ScenarioCase,
  type ScenarioCheck,
  type TestIssue,
  type TestSummary,
} from "./test-types.js";

function scenarioLabel(scenario: ScenarioCase): string {
  return `${scenario.serviceName} :: ${scenario.name}`;
}

function apiMatches(
  apis: ServiceIrSlice["apis"],
  method: string,
  path: string,
): boolean {
  const normalizedMethod = method.toUpperCase();
  return apis.some(
    (api) => api.method.toUpperCase() === normalizedMethod && api.path === path,
  );
}

function validateScenario(
  scenario: ScenarioCase,
  slice: ServiceIrSlice,
): TestIssue | undefined {
  let whenClause;
  try {
    whenClause = parseWhenClause(scenario.when);
  } catch (error) {
    return {
      code: TestIssueCode.ParseWhenFailed,
      scenario: scenario.name,
      service: scenario.serviceName,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  let thenClause;
  try {
    thenClause = parseThenClause(scenario.then);
  } catch (error) {
    return {
      code: TestIssueCode.ParseThenFailed,
      scenario: scenario.name,
      service: scenario.serviceName,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!apiMatches(slice.apis, whenClause.when.method, whenClause.when.path)) {
    return {
      code: TestIssueCode.ApiNotFound,
      scenario: scenario.name,
      service: scenario.serviceName,
      message:
        `No @api matches ${whenClause.when.method} ${whenClause.when.path} ` +
        `declared in ${scenario.serviceName}`,
    };
  }

  if (!thenClause.httpStatus) {
    return {
      code: TestIssueCode.MissingStatus,
      scenario: scenario.name,
      service: scenario.serviceName,
      message: `Then clause must include an HTTP status (e.g. 'status is 200'): ${scenario.then}`,
    };
  }

  return undefined;
}

export function validateScenarios(slices: readonly ServiceIrSlice[]): TestSummary {
  const checks: ScenarioCheck[] = [];

  for (const slice of slices) {
    for (const scenario of slice.scenarios) {
      const issue = validateScenario(scenario, slice);
      checks.push({
        scenario,
        verdict: issue ? TestVerdict.Fail : TestVerdict.Pass,
        issue,
      });
    }
  }

  const failed = checks.filter((check) => check.verdict === TestVerdict.Fail).length;
  return {
    passed: checks.length - failed,
    failed,
    total: checks.length,
    checks,
  };
}

export function formatScenarioLine(check: ScenarioCheck): string {
  const label = scenarioLabel(check.scenario);
  if (check.verdict === TestVerdict.Pass) {
    return `ok  ${label}`;
  }
  return `FAIL ${label}: ${check.issue?.message ?? "unknown error"}`;
}
