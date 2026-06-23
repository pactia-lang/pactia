import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileWorkspace, parsePactiaLock } from "@pactia/pactiac";
import { writeCompileOutput } from "../io/write-output.js";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
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
  readonly lockWritten: boolean;
}

export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildError";
  }
}

const DEFAULT_OUTPUT_DIR = "out";

export async function runBuild(options: BuildOptions = {}): Promise<BuildResult> {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? error : new BuildError(String(error));
  }

  const resolved = await resolveWorkspaceLock(workspaceRoot);

  let vendoredPackages: readonly string[] = [];
  if (resolved.lock.packages.length > 0) {
    try {
      vendoredPackages = ensureVendoredPackages(workspaceRoot, resolved.lock);
    } catch (error) {
      if (error instanceof VendorError) {
        throw new BuildError(error.message);
      }
      throw error;
    }
  }

  const lockPath = join(workspaceRoot, "pactia.lock");
  if (resolved.lock.packages.length > 0 && !existsSync(lockPath)) {
    throw new BuildError("pactia.lock is missing after resolution");
  }

  if (resolved.lock.packages.length > 0) {
    parsePactiaLock(readFileSync(lockPath, "utf8"));
  }

  const compileResult = compileWorkspace(workspaceRoot);
  if (compileResult.files.size === 0) {
    const messages = compileResult.diagnostics.map((d) => d.message).join("\n");
    throw new BuildError(messages.length > 0 ? messages : "Compile produced no output");
  }

  const outputDir = resolve(workspaceRoot, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const filesWritten = writeCompileOutput(compileResult.files, outputDir);

  return {
    workspaceRoot,
    outputDir,
    filesWritten,
    vendoredPackages,
    lockWritten: resolved.written,
  };
}
