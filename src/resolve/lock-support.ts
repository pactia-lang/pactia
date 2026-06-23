import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePackageToml } from "@pactia/pactiac";
import type { PactiaLockManifest } from "@pactia/pactiac";
import { serializePactiaLock } from "./lock-file.js";
import { scanPackageIndex, type IndexedPackageVersion } from "./package-index.js";
import { packageSearchRoots } from "../vendor/cache-paths.js";

export function buildPackageIndex(workspaceRoot: string): IndexedPackageVersion[] {
  const index: IndexedPackageVersion[] = [];
  for (const root of packageSearchRoots(workspaceRoot)) {
    index.push(...scanPackageIndex(root));
  }
  return index;
}

export function readPackageDependencies(packageDir: string): ReadonlyMap<string, string> {
  const manifestPath = join(packageDir, "pactia.toml");
  if (!existsSync(manifestPath)) {
    return new Map();
  }
  return parsePackageToml(readFileSync(manifestPath, "utf8")).dependencies;
}

export function lockEntryMap(
  lock: PactiaLockManifest,
): Map<string, { version: string; digest: string }> {
  return new Map(
    lock.packages.map((entry) => [
      entry.name,
      { version: entry.version, digest: entry.digest },
    ]),
  );
}

export function writeLockIfChanged(workspaceRoot: string, lock: PactiaLockManifest): boolean {
  const lockPath = join(workspaceRoot, "pactia.lock");
  const serialized = serializePactiaLock(lock);
  const previous = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
  const written = previous !== serialized;
  if (written) {
    writeFileSync(lockPath, serialized, "utf8");
  }
  return written;
}
