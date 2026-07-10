import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock } from "@pactia/pactiac";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { serializePactiaLock } from "../resolve/lock-file.js";
import { parseWorkspaceToml, removeDependency } from "../resolve/workspace-toml.js";

export interface RemoveOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
}

export interface RemoveResult {
  readonly workspaceRoot: string;
  readonly coordinate: string;
  readonly removed: boolean;
  readonly lockUpdated: boolean;
}

export class RemoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoveError";
  }
}

function removeFromLock(workspaceRoot: string, coordinate: string): boolean {
  const lockPath = join(workspaceRoot, "pactia.lock");
  if (!existsSync(lockPath)) {
    return false;
  }
  const lock = parsePactiaLock(readFileSync(lockPath, "utf8"));
  const filtered = lock.packages.filter((pkg) => pkg.name !== coordinate);
  if (filtered.length === lock.packages.length) {
    return false;
  }

  if (filtered.length === 0) {
    unlinkSync(lockPath);
    return true;
  }

  writeFileSync(
    lockPath,
    serializePactiaLock({ packages: filtered }),
    "utf8",
  );

  return true;
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
    return { workspaceRoot, coordinate, removed: false, lockUpdated: false };
  }
  writeFileSync(tomlPath, nextToml, "utf8");

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

  // Remove matching entries from pactia.lock (P0 fix)
  const lockUpdated = removeFromLock(workspaceRoot, coordinate);

  // When all dependencies are removed, delete the lock entirely (P0 fix)
  const updatedToml = parseWorkspaceToml(readFileSync(tomlPath, "utf8"));
  if (updatedToml.dependencies.size === 0) {
    const lockPath = join(workspaceRoot, "pactia.lock");
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  }

  return { workspaceRoot, coordinate, removed: true, lockUpdated };
}
