import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock } from "@pactia/pactiac";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface ListOptions {
  readonly workspaceRoot?: string;
  readonly json?: boolean;
}

export interface ListEntry {
  readonly name: string;
  readonly version: string;
  readonly digest: string;
}

export interface ListResult {
  readonly workspaceRoot: string;
  readonly packages: readonly ListEntry[];
}

export class ListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListError";
  }
}

export function runList(options: ListOptions = {}): ListResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new ListError(error.message) : error;
  }

  const lockPath = join(workspaceRoot, "pactia.lock");
  if (!existsSync(lockPath)) {
    return { workspaceRoot, packages: [] };
  }

  const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));
  const packages = lock.packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    digest: pkg.digest,
  }));

  return { workspaceRoot, packages };
}