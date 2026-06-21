import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileWorkspace, parsePactiaLock } from "@pactia/pactiac";
import { writeCompileOutput } from "../io/write-output.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface BuildOptions {
  readonly workspaceRoot?: string;
  readonly outputDir?: string;
}

export interface BuildResult {
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly filesWritten: readonly string[];
  readonly vendoredPackages: readonly string[];
}

export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildError";
  }
}

const DEFAULT_OUTPUT_DIR = "out";

export function runBuild(options: BuildOptions = {}): BuildResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? error : new BuildError(String(error));
  }

  const lockPath = join(workspaceRoot, "pactia.lock");
  const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));

  let vendoredPackages: readonly string[] = [];
  try {
    vendoredPackages = ensureVendoredPackages(workspaceRoot, lock);
  } catch (error) {
    if (error instanceof VendorError) {
      throw new BuildError(error.message);
    }
    throw error;
  }

  const compileResult = compileWorkspace(workspaceRoot);
  if (compileResult.files.size === 0) {
    const messages = compileResult.diagnostics.map((d) => d.message).join("\n");
    throw new BuildError(messages.length > 0 ? messages : "Compile produced no output");
  }

  const outputDir = resolve(workspaceRoot, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const filesWritten = writeCompileOutput(compileResult.files, outputDir);

  return { workspaceRoot, outputDir, filesWritten, vendoredPackages };
}
