import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePactiaLock } from "@pactia/pactiac";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
import { upsertDependency, parseWorkspaceToml } from "../resolve/workspace-toml.js";
import { ensureVendoredPackages, VendorError } from "../vendor/ensure-vendored.js";
import { InstallWorkspaceError } from "./install-workspace.js";

export interface AddOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
  readonly range?: string;
}

export interface AddResult {
  readonly workspaceRoot: string;
  readonly coordinate: string;
  readonly range: string;
  readonly lockWritten: boolean;
  readonly installed: readonly string[];
  readonly vendoredPackages: readonly string[];
  /** Transitive dependencies discovered through imported packages. */
  readonly transitiveDeps: readonly string[];
}

const DEFAULT_RANGE = "^1.0";

export async function runAdd(options: AddOptions): Promise<AddResult> {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const coordinate = normalizeCoordinate(options.coordinate);
  const range = options.range ?? DEFAULT_RANGE;

  const tomlPath = join(workspaceRoot, "pactia.toml");
  const source = readFileSync(tomlPath, "utf8");
  const nextToml = upsertDependency(source, coordinate, range);
  writeFileSync(tomlPath, nextToml, "utf8");

  const resolved = await resolveWorkspaceLock(workspaceRoot);

  // Detect transitive dependencies: lock packages not in pactia.toml [dependencies]
  const tomlSource = readFileSync(tomlPath, "utf8");
  const toml = parseWorkspaceToml(tomlSource);
  const transitiveDeps: string[] = [];
  if (existsSync(join(workspaceRoot, "pactia.lock"))) {
    const lock = parsePactiaLock(readFileSync(join(workspaceRoot, "pactia.lock"), "utf8"));
    for (const pkg of lock.packages) {
      if (!toml.dependencies.has(pkg.name) && pkg.name !== coordinate) {
        transitiveDeps.push(pkg.name);
      }
    }
  }

  let vendoredPackages: readonly string[] = [];
  try {
    vendoredPackages = ensureVendoredPackages(workspaceRoot, resolved.lock);
  } catch (error) {
    if (error instanceof VendorError) {
      throw new InstallWorkspaceError(error.message);
    }
    throw error;
  }

  return {
    workspaceRoot,
    coordinate,
    range,
    lockWritten: resolved.written,
    installed: resolved.fetched,
    vendoredPackages,
    transitiveDeps,
  };
}
