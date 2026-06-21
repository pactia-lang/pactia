import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { resolveWorkspaceLock } from "../resolve/lock-resolver.js";
import { upsertDependency } from "../resolve/workspace-toml.js";
import { readFileSync } from "node:fs";

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
  readonly fetched: readonly string[];
}

const DEFAULT_RANGE = "^1.0";

export function runAdd(options: AddOptions): AddResult {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const coordinate = normalizeCoordinate(options.coordinate);
  const range = options.range ?? DEFAULT_RANGE;

  const tomlPath = join(workspaceRoot, "pactia.toml");
  const source = readFileSync(tomlPath, "utf8");
  const nextToml = upsertDependency(source, coordinate, range);
  writeFileSync(tomlPath, nextToml, "utf8");

  const resolved = resolveWorkspaceLock(workspaceRoot);
  return {
    workspaceRoot,
    coordinate,
    range,
    lockWritten: resolved.written,
    fetched: resolved.fetched,
  };
}
