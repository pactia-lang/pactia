import { resolve } from "node:path";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface FetchOptions {
  readonly workspaceRoot?: string;
}

export interface FetchResult {
  readonly workspaceRoot: string;
  readonly lockWritten: boolean;
  readonly fetched: readonly string[];
  readonly vendoredPackages: readonly string[];
}

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

export function runFetch(options: FetchOptions = {}): FetchResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? error : new FetchError(String(error));
  }

  const resolved = resolveWorkspaceLock(workspaceRoot);

  let vendoredPackages: readonly string[] = [];
  try {
    vendoredPackages = ensureVendoredPackages(workspaceRoot, resolved.lock);
  } catch (error) {
    if (error instanceof VendorError) {
      throw new FetchError(error.message);
    }
    throw error;
  }

  return {
    workspaceRoot,
    lockWritten: resolved.written,
    fetched: resolved.fetched,
    vendoredPackages,
  };
}
