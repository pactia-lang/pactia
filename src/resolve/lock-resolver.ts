import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  hashDirectoryMarker,
  parsePackageToml,
  parsePactiaLock,
  type PactiaLockManifest,
} from "@pactia/pactiac";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { materializePackageCache } from "../install/install-package.js";
import {
  findIndexedPackage,
  listVersionsInIndex,
  scanPackageIndex,
  type IndexedPackageVersion,
} from "./package-index.js";
import { serializePactiaLock } from "./lock-file.js";
import { pickBestVersion, satisfiesSemver } from "./semver.js";
import { listRemoteVersions } from "./package-tags.js";
import { parseWorkspaceToml } from "./workspace-toml.js";
import { packageSearchRoots } from "../vendor/cache-paths.js";

export interface ResolvedLock {
  readonly lock: PactiaLockManifest;
  readonly written: boolean;
  readonly fetched: readonly string[];
}

interface PendingPackage {
  readonly coordinate: string;
  readonly range: string;
}

function buildPackageIndex(workspaceRoot: string): IndexedPackageVersion[] {
  const index: IndexedPackageVersion[] = [];
  for (const root of packageSearchRoots(workspaceRoot)) {
    index.push(...scanPackageIndex(root));
  }
  return index;
}

function readPackageDependencies(packageDir: string): ReadonlyMap<string, string> {
  const manifestPath = join(packageDir, "pactia.toml");
  if (!existsSync(manifestPath)) {
    return new Map();
  }
  return parsePackageToml(readFileSync(manifestPath, "utf8")).dependencies;
}

function readWorkspaceLock(workspaceRoot: string): PactiaLockManifest {
  const lockPath = join(workspaceRoot, "pactia.lock");
  if (!existsSync(lockPath)) {
    throw new ResolveError(
      ResolveErrorCode.LockMissing,
      "pactia.lock is missing; run pactia add or pactia update to create it",
    );
  }
  return parsePactiaLock(readFileSync(lockPath, "utf8"));
}

function lockEntryMap(lock: PactiaLockManifest): Map<string, { version: string; digest: string }> {
  return new Map(
    lock.packages.map((entry) => [
      entry.name,
      { version: entry.version, digest: entry.digest },
    ]),
  );
}

function validateDirectDependencies(
  workspace: ReturnType<typeof parseWorkspaceToml>,
  lock: PactiaLockManifest,
): void {
  const entries = lockEntryMap(lock);
  for (const [coordinate, range] of workspace.dependencies) {
    const entry = entries.get(coordinate);
    if (!entry) {
      throw new ResolveError(
        ResolveErrorCode.LockStale,
        `'${coordinate}' is in pactia.toml but missing from pactia.lock; run pactia add or pactia update`,
      );
    }
    if (!satisfiesSemver(entry.version, range)) {
      throw new ResolveError(
        ResolveErrorCode.LockStale,
        `locked version '${entry.version}' of '${coordinate}' does not satisfy '${range}'; run pactia update`,
      );
    }
  }
}

async function resolveVersion(
  index: readonly IndexedPackageVersion[],
  coordinate: string,
  range: string,
): Promise<{ version: string; localDir?: string }> {
  const localVersions = listVersionsInIndex(index, coordinate);
  const remoteVersions =
    localVersions.length === 0 ? await listRemoteVersions(coordinate) : [];
  const available = [...new Set([...localVersions, ...remoteVersions])];
  const version = pickBestVersion(available, range);
  if (!version) {
    throw new ResolveError(
      ResolveErrorCode.VersionNotFound,
      `No version of '${coordinate}' satisfies '${range}'`,
    );
  }

  const indexed = findIndexedPackage(index, coordinate, version);
  return { version, localDir: indexed?.rootDir };
}

async function resolveDependencyGraph(
  workspaceRoot: string,
  roots: readonly PendingPackage[],
): Promise<{
  readonly lock: PactiaLockManifest;
  readonly fetched: readonly string[];
}> {
  const index = buildPackageIndex(workspaceRoot);
  const queue: PendingPackage[] = [...roots];
  const seen = new Set<string>();
  const resolved = new Map<
    string,
    { version: string; digest: string; rootDir: string }
  >();
  const fetched: string[] = [];

  while (queue.length > 0) {
    const pending = queue.shift()!;
    if (seen.has(pending.coordinate)) continue;
    seen.add(pending.coordinate);

    const { version, localDir } = await resolveVersion(
      index,
      pending.coordinate,
      pending.range,
    );
    const cacheDir = await materializePackageCache(
      pending.coordinate,
      version,
      localDir,
    );
    if (!localDir) {
      fetched.push(`${pending.coordinate}@${version}`);
    }

    const digest = hashDirectoryMarker(cacheDir);
    resolved.set(pending.coordinate, { version, digest, rootDir: cacheDir });

    for (const [depCoordinate, depRange] of readPackageDependencies(cacheDir)) {
      if (!seen.has(depCoordinate)) {
        queue.push({ coordinate: depCoordinate, range: depRange });
      }
    }
  }

  const lock: PactiaLockManifest = {
    packages: [...resolved.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entry]) => ({
        name,
        version: entry.version,
        digest: entry.digest,
      })),
  };

  return { lock, fetched };
}

function writeLockIfChanged(workspaceRoot: string, lock: PactiaLockManifest): boolean {
  const lockPath = join(workspaceRoot, "pactia.lock");
  const serialized = serializePactiaLock(lock);
  const previous = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
  const written = previous !== serialized;
  if (written) {
    writeFileSync(lockPath, serialized, "utf8");
  }
  return written;
}

/** Re-resolve dependency ranges from pactia.toml and refresh pactia.lock (add / update). */
export async function resolveWorkspaceLock(workspaceRoot: string): Promise<ResolvedLock> {
  const tomlPath = join(workspaceRoot, "pactia.toml");
  const lockPath = join(workspaceRoot, "pactia.lock");

  const workspace = parseWorkspaceToml(readFileSync(tomlPath, "utf8"));
  if (workspace.dependencies.size === 0) {
    const emptyLock: PactiaLockManifest = { packages: [] };
    if (existsSync(lockPath)) {
      rmSync(lockPath);
    }
    return { lock: emptyLock, written: false, fetched: [] };
  }

  const roots = [...workspace.dependencies.entries()].map(([coordinate, range]) => ({
    coordinate,
    range,
  }));
  const { lock, fetched } = await resolveDependencyGraph(workspaceRoot, roots);
  const written = writeLockIfChanged(workspaceRoot, lock);
  return { lock, written, fetched };
}

/** Re-resolve one or all dependencies and refresh pactia.lock. */
export async function updateWorkspaceLock(
  workspaceRoot: string,
  coordinate?: string,
): Promise<ResolvedLock> {
  const tomlPath = join(workspaceRoot, "pactia.toml");
  const workspace = parseWorkspaceToml(readFileSync(tomlPath, "utf8"));

  if (coordinate && !workspace.dependencies.has(coordinate)) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `'${coordinate}' is not a dependency in pactia.toml`,
    );
  }

  return resolveWorkspaceLock(workspaceRoot);
}

/** Install packages pinned in pactia.lock without re-resolving versions. */
export async function installLockedPackages(workspaceRoot: string): Promise<ResolvedLock> {
  const tomlPath = join(workspaceRoot, "pactia.toml");
  const workspace = parseWorkspaceToml(readFileSync(tomlPath, "utf8"));

  if (workspace.dependencies.size === 0) {
    return { lock: { packages: [] }, written: false, fetched: [] };
  }

  const lock = readWorkspaceLock(workspaceRoot);
  validateDirectDependencies(workspace, lock);

  const entries = lockEntryMap(lock);
  const index = buildPackageIndex(workspaceRoot);
  const fetched: string[] = [];
  const visited = new Set<string>();
  const queue = [...workspace.dependencies.keys()];

  while (queue.length > 0) {
    const coordinate = queue.shift()!;
    if (visited.has(coordinate)) {
      continue;
    }
    visited.add(coordinate);

    const entry = entries.get(coordinate);
    if (!entry) {
      throw new ResolveError(
        ResolveErrorCode.LockStale,
        `'${coordinate}' is required but missing from pactia.lock; run pactia update`,
      );
    }

    const indexed = findIndexedPackage(index, coordinate, entry.version);
    const hadLocal = indexed?.rootDir !== undefined;
    const cacheDir = await materializePackageCache(
      coordinate,
      entry.version,
      indexed?.rootDir,
    );
    if (!hadLocal) {
      fetched.push(`${coordinate}@${entry.version}`);
    }

    const digest = hashDirectoryMarker(cacheDir);
    if (digest !== entry.digest) {
      throw new ResolveError(
        ResolveErrorCode.LockDigestMismatch,
        `digest mismatch for '${coordinate}@${entry.version}': lock has ${entry.digest}, installed tree has ${digest}`,
      );
    }

    for (const [depCoordinate] of readPackageDependencies(cacheDir)) {
      if (!visited.has(depCoordinate)) {
        queue.push(depCoordinate);
      }
    }
  }

  for (const lockEntry of lock.packages) {
    if (!visited.has(lockEntry.name)) {
      throw new ResolveError(
        ResolveErrorCode.LockStale,
        `'${lockEntry.name}' is listed in pactia.lock but is not required; run pactia update`,
      );
    }
  }

  return { lock, written: false, fetched };
}
