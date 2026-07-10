import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock, parsePackageToml } from "@pactia/pactiac";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";
import { packageDirName } from "../domain/package-coordinate.js";
import { packageSearchRoots } from "../vendor/cache-paths.js";

export interface InfoOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
}

export interface InfoResult {
  readonly coordinate: string;
  readonly version: string;
  readonly location: string;
  readonly dependencies: Readonly<Record<string, string>>;
}

export class InfoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfoError";
  }
}

export function runInfo(options: InfoOptions): InfoResult {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new InfoError(error.message) : error;
  }

  const coordinate = normalizeCoordinate(options.coordinate);

  const lockPath = join(workspaceRoot, "pactia.lock");
  if (!existsSync(lockPath)) {
    throw new InfoError("pactia.lock not found; run pactia add or pactia install first");
  }

  const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));
  const lockEntry = lock.packages.find((pkg) => pkg.name === coordinate);
  if (!lockEntry) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `'${coordinate}' not found in pactia.lock`,
    );
  }

  const dirName = packageDirName(coordinate, lockEntry.version);
  let location: string | undefined;
  for (const root of packageSearchRoots(workspaceRoot)) {
    const candidate = join(root, dirName);
    if (existsSync(join(candidate, "pactia.toml"))) {
      location = candidate;
      break;
    }
  }

  if (!location) {
    throw new InfoError(`'${coordinate}@${lockEntry.version}' is in the lock but not vendored. Run pactia install.`);
  }

  const manifest = parsePackageToml(readFileSync(join(location, "pactia.toml"), "utf8"));
  const dependencies: Record<string, string> = {};
  for (const [dep, range] of manifest.dependencies) {
    dependencies[dep] = range;
  }

  return {
    coordinate,
    version: lockEntry.version,
    location,
    dependencies,
  };
}