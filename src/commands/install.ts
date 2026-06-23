import {
  installWorkspacePackages,
  InstallWorkspaceError,
  type InstallWorkspaceResult,
} from "./install-workspace.js";

export interface InstallOptions {
  readonly workspaceRoot?: string;
}

export class InstallError extends InstallWorkspaceError {}

export type InstallResult = InstallWorkspaceResult;

export async function runInstall(options: InstallOptions = {}): Promise<InstallResult> {
  return installWorkspacePackages(options.workspaceRoot);
}
