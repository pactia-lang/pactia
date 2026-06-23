import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { hashDirectoryMarker, type PactiaLockManifest } from "@pactia/pactiac";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { materializePackageCache } from "../install/install-package.js";
import {
  findIndexedPackage,
  listVersionsInIndex,
  type IndexedPackageVersion,
} from "./package-index.js";
import {
  buildPackageIndex,
  readPackageDependencies,
  writeLockIfChanged,
} from "./lock-support.js";
import type { ResolvedLock } from "./lock-types.js";
import { pickBestVersion } from "./semver.js";
import { listRemoteVersions } from "./package-tags.js";
import { parseWorkspaceToml } from "./workspace-toml.js";

interface PendingPackage {
  readonly coordinate: string;
  readonly range: string;
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
