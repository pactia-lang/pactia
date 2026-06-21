import { runBuild, type BuildOptions, type BuildResult, BuildError } from "./build.js";
import { collectServiceIr } from "../test/collect-scenarios.js";
import {
  formatScenarioLine,
  validateScenarios,
} from "../test/validate-scenarios.js";
import { TestVerdict, type ScenarioCheck, type TestSummary } from "../test/test-types.js";

export interface TestOptions extends BuildOptions {}

export interface TestResult extends BuildResult {
  readonly summary: TestSummary;
}

export class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestError";
  }
}

export function runTest(options: TestOptions = {}): TestResult {
  let build: BuildResult;
  try {
    build = runBuild(options);
  } catch (error) {
    if (error instanceof BuildError) {
      throw new TestError(error.message);
    }
    throw error;
  }

  const slices = collectServiceIr(build.outputDir);
  const summary = validateScenarios(slices);

  if (summary.failed > 0) {
    const lines = summary.checks
      .filter((check) => check.verdict === TestVerdict.Fail)
      .map((check) => formatScenarioLine(check));
    throw new TestError(
      `${summary.failed} of ${summary.total} scenario(s) failed:\n${lines.join("\n")}`,
    );
  }

  return { ...build, summary };
}

export function formatTestReport(summary: TestSummary): string[] {
  return summary.checks.map((check) => formatScenarioLine(check));
}
