import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

export enum PackageCacheKind {
  Global = "global",
  VendorEnv = "vendor_env",
  Workspace = "workspace",
}

const GLOBAL_CACHE_DIR = join(homedir(), ".pactia", "packages");
const WORKSPACE_VENDOR_DIR = ".pactia/packages";

export function globalPackageCacheDir(): string {
  return GLOBAL_CACHE_DIR;
}

export function workspaceVendorDir(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), WORKSPACE_VENDOR_DIR);
}

export function packageSearchRoots(workspaceRoot: string): readonly string[] {
  const roots: string[] = [workspaceVendorDir(workspaceRoot), globalPackageCacheDir()];

  const envRoot = process.env["PACTIA_VENDOR_ROOT"];
  if (envRoot) {
    roots.push(resolve(envRoot));
  }

  const monorepoCandidates = [
    join(workspaceRoot, "..", "..", "pactiac", "test", "fixtures", "packages"),
    join(workspaceRoot, "..", "pactiac", "test", "fixtures", "packages"),
  ];
  for (const candidate of monorepoCandidates) {
    if (existsSync(candidate)) {
      roots.push(resolve(candidate));
    }
  }

  return [...new Set(roots)];
}
