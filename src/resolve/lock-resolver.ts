import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  hashDirectoryMarker,
  parsePackageToml,
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
import { pickBestVersion } from "./semver.js";
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

  const index = buildPackageIndex(workspaceRoot);
  const queue: PendingPackage[] = [...workspace.dependencies.entries()].map(
    ([coordinate, range]) => ({ coordinate, range }),
  );
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

  const serialized = serializePactiaLock(lock);
  const previous = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
  const written = previous !== serialized;
  if (written) {
    writeFileSync(lockPath, serialized, "utf8");
  }

  return { lock, written, fetched };
}
