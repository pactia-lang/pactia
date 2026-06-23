import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hashDirectoryMarker,
  parsePactiaLock,
  type PactiaLockManifest,
} from "@pactia/pactiac";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { materializePackageCache } from "../install/install-package.js";
import { findIndexedPackage } from "./package-index.js";
import {
  buildPackageIndex,
  lockEntryMap,
  readPackageDependencies,
} from "./lock-support.js";
import type { ResolvedLock } from "./lock-types.js";
import { satisfiesSemver } from "./semver.js";
import { parseWorkspaceToml } from "./workspace-toml.js";

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
