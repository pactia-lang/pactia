import { runBuild, type BuildOptions, type BuildResult } from "./build.js";

/** Compile the workspace (pactia test = pactia build for now — acceptance harness TBD). */
export function runTest(options: BuildOptions = {}): BuildResult {
  return runBuild(options);
}
