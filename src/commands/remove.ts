import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock } from "@pactia/pactiac";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { removeDependency } from "../resolve/workspace-toml.js";
import { writeLockIfChanged } from "../resolve/lock-support.js";

export interface RemoveOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
}

export interface RemoveResult {
  readonly workspaceRoot: string;
  readonly coordinate: string;
  readonly removed: boolean;
  readonly transitiveDependents: readonly string[];
}

export class RemoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoveError";
  }
}

function findTransitiveDependents(workspaceRoot: string, removedCoordinate: string): string[] {
  const dependents: string[] = [];
  const vendorDir = join(workspaceRoot, ".pactia", "packages");
  if (!existsSync(vendorDir)) return dependents;

  for (const entry of readdirSync(vendorDir)) {
    const pkgDir = join(vendorDir, entry);
    const indexPath = join(pkgDir, "index.pactia");
    if (!existsSync(indexPath)) continue;

    const indexSource = readFileSync(indexPath, "utf8");
    const escaped = removedCoordinate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const importPattern = new RegExp(`import\\s+(?:\\{[^}]*\\}\\s+from\\s+)?${escaped}\\s*;`);
    if (importPattern.test(indexSource)) {
      const pkgName = entry.replace(/@[^@]+$/, "").replace(/--/g, "/");
      dependents.push(pkgName);
    }
  }

  return dependents;
}

export function runRemove(options: RemoveOptions): RemoveResult {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const coordinate = normalizeCoordinate(options.coordinate);

  const tomlPath = join(workspaceRoot, "pactia.toml");
  if (!existsSync(tomlPath)) {
    throw new RemoveError(`pactia.toml not found in ${workspaceRoot}`);
  }

  const source = readFileSync(tomlPath, "utf8");
  const nextToml = removeDependency(source, coordinate);
  if (nextToml === source) {
    return { workspaceRoot, coordinate, removed: false, transitiveDependents: [] };
  }
  writeFileSync(tomlPath, nextToml, "utf8");

  // Remove from pactia.lock
  const lockPath = join(workspaceRoot, "pactia.lock");
  if (existsSync(lockPath)) {
    const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));
    const filtered = lock.packages.filter((pkg) => pkg.name !== coordinate);
    if (filtered.length !== lock.packages.length) {
      writeLockIfChanged(workspaceRoot, { packages: filtered });
    }
  }

  // Clean vendored package directory
  const pkgDirName = `${coordinate.replace(/\//g, "--")}@`;
  const vendorDir = join(workspaceRoot, ".pactia", "packages");
  if (existsSync(vendorDir)) {
    for (const entry of readdirSync(vendorDir)) {
      if (entry.startsWith(pkgDirName)) {
        rmSync(join(vendorDir, entry), { recursive: true, force: true });
      }
    }
  }

  const transitiveDependents = findTransitiveDependents(workspaceRoot, coordinate);

  return { workspaceRoot, coordinate, removed: true, transitiveDependents };
}
