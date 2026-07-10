import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface CleanOptions {
  readonly workspaceRoot?: string;
  readonly outputDir?: string;
  /** When true, only clean ~/.pactia/cache/ — skip workspace dirs. */
  readonly cacheOnly?: boolean;
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
const GLOBAL_CACHE_DIR = join(homedir(), ".pactia", "cache");

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

  if (options.cacheOnly) {
    if (existsSync(GLOBAL_CACHE_DIR)) {
      rmSync(GLOBAL_CACHE_DIR, { recursive: true, force: true });
      removed.push(GLOBAL_CACHE_DIR);
    }
    return { workspaceRoot, removed };
  }

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
