import { resolve } from "node:path";
import { installLockedPackages } from "../resolve/lock-resolver.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface InstallWorkspaceOptions {
  readonly workspaceRoot?: string;
  readonly offline?: boolean;
}

export interface InstallWorkspaceResult {
  readonly workspaceRoot: string;
  readonly lockWritten: boolean;
  readonly installed: readonly string[];
  readonly vendoredPackages: readonly string[];
}

export class InstallWorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstallWorkspaceError";
  }
}

export async function installWorkspacePackages(
  options: InstallWorkspaceOptions = {},
): Promise<InstallWorkspaceResult> {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError
      ? error
      : new InstallWorkspaceError(String(error));
  }

  const resolved = await installLockedPackages(workspaceRoot, options.offline);

  let vendoredPackages: readonly string[] = [];
  try {
    vendoredPackages = ensureVendoredPackages(workspaceRoot, resolved.lock);
  } catch (error) {
    if (error instanceof VendorError) {
      throw new InstallWorkspaceError(error.message);
    }
    throw error;
  }

  return {
    workspaceRoot,
    lockWritten: resolved.written,
    installed: resolved.fetched,
    vendoredPackages,
  };
}
