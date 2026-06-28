import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { removeDependency } from "../resolve/workspace-toml.js";

export interface RemoveOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
}

export interface RemoveResult {
  readonly workspaceRoot: string;
  readonly coordinate: string;
  readonly removed: boolean;
}

export class RemoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoveError";
  }
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
    return { workspaceRoot, coordinate, removed: false };
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

  return { workspaceRoot, coordinate, removed: true };
}
