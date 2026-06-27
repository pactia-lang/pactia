import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface CleanOptions {
  readonly workspaceRoot?: string;
  readonly outputDir?: string;
}

export interface CleanResult {
  readonly workspaceRoot: string;
  readonly removed: readonly string[];
}

export class CleanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CleanError";
  }
}

const DEFAULT_OUTPUT_DIR = "out";
const VENDOR_DIR = ".pactia";

export function runClean(options: CleanOptions = {}): CleanResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new CleanError(error.message) : error;
  }

  const removed: string[] = [];

  // Remove vendor directory
  const vendorPath = join(workspaceRoot, VENDOR_DIR);
  if (existsSync(vendorPath)) {
    rmSync(vendorPath, { recursive: true, force: true });
    removed.push(vendorPath);
  }

  // Remove build output directory
  const outputPath = join(workspaceRoot, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true });
    removed.push(outputPath);
  }

  return { workspaceRoot, removed };
}
