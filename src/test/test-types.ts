export enum TestVerdict {
  Pass = "pass",
  Fail = "fail",
}

export enum TestIssueCode {
  ParseWhenFailed = "PARSE_WHEN_FAILED",
  ParseThenFailed = "PARSE_THEN_FAILED",
  ApiNotFound = "API_NOT_FOUND",
  MissingStatus = "MISSING_STATUS",
}

export interface TestIssue {
  readonly code: TestIssueCode;
  readonly scenario: string;
  readonly service: string;
  readonly message: string;
}

export interface ScenarioCase {
  readonly serviceFile: string;
  readonly serviceName: string;
  readonly id: string;
  readonly name: string;
  readonly when: string;
  readonly then: string;
}

export interface ScenarioCheck {
  readonly scenario: ScenarioCase;
  readonly verdict: TestVerdict;
  readonly issue?: TestIssue;
}

export interface TestSummary {
  readonly passed: number;
  readonly failed: number;
  readonly total: number;
  readonly checks: readonly ScenarioCheck[];
}
