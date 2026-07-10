import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock } from "@pactia/pactiac";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";

export interface VendorOptions {
  readonly workspaceRoot?: string;
}

export interface VendorResult {
  readonly workspaceRoot: string;
  readonly vendoredPackages: readonly string[];
}

export class VendorCmdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorCmdError";
  }
}

export function runVendor(options: VendorOptions = {}): VendorResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError
      ? new VendorCmdError(error.message)
      : error;
  }

  const lockPath = join(workspaceRoot, "pactia.lock");
  if (!existsSync(lockPath)) {
    throw new VendorCmdError(
      "pactia.lock not found; run pactia add or pactia install first",
    );
  }

  const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));
  if (lock.packages.length === 0) {
    return { workspaceRoot, vendoredPackages: [] };
  }

  try {
    const copied = ensureVendoredPackages(workspaceRoot, lock);
    return { workspaceRoot, vendoredPackages: copied };
  } catch (error) {
    if (error instanceof VendorError) {
      throw new VendorCmdError(error.message);
    }
    throw error;
  }
}