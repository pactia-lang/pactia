import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

export enum PackageCacheKind {
  Global = "global",
  VendorEnv = "vendor_env",
  Workspace = "workspace",
}

const GLOBAL_CACHE_DIR = join(homedir(), ".pactia", "packages");
const VERSION_INDEX_CACHE_DIR = join(homedir(), ".pactia", "cache");
const WORKSPACE_VENDOR_DIR = ".pactia/packages";

function resolveOverride(envName: string, defaultDir: string): string {
  const override = process.env[envName];
  return override ? resolve(override) : defaultDir;
}

export function globalPackageCacheDir(): string {
  return resolveOverride("PACTIA_PACKAGES_DIR", GLOBAL_CACHE_DIR);
}

export function versionIndexCacheDir(): string {
  return resolveOverride("PACTIA_VERSION_CACHE_DIR", VERSION_INDEX_CACHE_DIR);
}

export function versionIndexCachePath(coordinate: string): string {
  const encoded = coordinate.slice(1).replace(/\//g, "--");
  return join(versionIndexCacheDir(), `@${encoded}`, "versions.json");
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
