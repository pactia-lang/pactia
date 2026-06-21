import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePackageToml } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";

export interface IndexedPackageVersion {
  readonly coordinate: string;
  readonly version: string;
  readonly rootDir: string;
}

const PACKAGE_DIR_PATTERN = /^@.+--.+@\d+\.\d+\.\d+$/;

function isPackageDir(name: string): boolean {
  return PACKAGE_DIR_PATTERN.test(name);
}

function parseDirVersion(dirName: string): { coordinate: string; version: string } | undefined {
  const at = dirName.lastIndexOf("@");
  if (at <= 0) return undefined;
  const version = dirName.slice(at + 1);
  const coordinate = dirName.slice(0, at).replace(/--/g, "/");
  if (!coordinate.startsWith("@")) return undefined;
  return { coordinate, version };
}

export function scanPackageIndex(root: string): readonly IndexedPackageVersion[] {
  if (!existsSync(root)) return [];

  const found: IndexedPackageVersion[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isPackageDir(entry.name)) continue;

    const parsed = parseDirVersion(entry.name);
    if (!parsed) continue;

    const rootDir = join(root, entry.name);
    const manifestPath = join(rootDir, "pactia.toml");
    if (!existsSync(manifestPath)) continue;

    const manifest = parsePackageToml(readFileSync(manifestPath, "utf8"));
    if (manifest.name !== parsed.coordinate || manifest.version !== parsed.version) {
      continue;
    }

    found.push({
      coordinate: parsed.coordinate,
      version: parsed.version,
      rootDir,
    });
  }

  return found;
}

export function listVersionsInIndex(
  index: readonly IndexedPackageVersion[],
  coordinate: string,
): readonly string[] {
  return index
    .filter((entry) => entry.coordinate === coordinate)
    .map((entry) => entry.version);
}

export function findIndexedPackage(
  index: readonly IndexedPackageVersion[],
  coordinate: string,
  version: string,
): IndexedPackageVersion | undefined {
  return index.find(
    (entry) => entry.coordinate === coordinate && entry.version === version,
  );
}

export function indexedPackageDir(coordinate: string, version: string): string {
  return packageDirName(coordinate, version);
}
