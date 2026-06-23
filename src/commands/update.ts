import { resolve } from "node:path";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { updateWorkspaceLock } from "../resolve/lock-resolver.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";
import { InstallWorkspaceError } from "./install-workspace.js";

export interface UpdateOptions {
  readonly workspaceRoot?: string;
  readonly coordinate?: string;
}

export interface UpdateResult {
  readonly workspaceRoot: string;
  readonly coordinate?: string;
  readonly lockWritten: boolean;
  readonly installed: readonly string[];
  readonly vendoredPackages: readonly string[];
}

export class UpdateError extends InstallWorkspaceError {}

export async function runUpdate(options: UpdateOptions = {}): Promise<UpdateResult> {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new UpdateError(error.message) : error;
  }

  const coordinate = options.coordinate
    ? normalizeCoordinate(options.coordinate)
    : undefined;

  const resolved = await updateWorkspaceLock(workspaceRoot, coordinate);

  let vendoredPackages: readonly string[] = [];
  try {
    vendoredPackages = ensureVendoredPackages(workspaceRoot, resolved.lock);
  } catch (error) {
    if (error instanceof VendorError) {
      throw new UpdateError(error.message);
    }
    throw error;
  }

  return {
    workspaceRoot,
    coordinate,
    lockWritten: resolved.written,
    installed: resolved.fetched,
    vendoredPackages,
  };
}
