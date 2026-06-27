import { resolve } from "node:path";
import { listRemoteVersions } from "../resolve/package-tags.js";
import { parseSemver, type SemverParts } from "../resolve/semver.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";
import { installLockedPackages } from "../resolve/lock-resolver.js";

export interface OutdatedOptions {
  readonly workspaceRoot?: string;
  readonly json?: boolean;
}

export interface OutdatedEntry {
  readonly coordinate: string;
  readonly current: string;
  readonly latest?: string;
}

export interface OutdatedResult {
  readonly workspaceRoot: string;
  readonly entries: readonly OutdatedEntry[];
}

export class OutdatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutdatedError";
  }
}

function compareSemver(left: SemverParts, right: SemverParts): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

export async function runOutdated(options: OutdatedOptions = {}): Promise<OutdatedResult> {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new OutdatedError(error.message) : error;
  }

  const resolved = await installLockedPackages(workspaceRoot);
  const entries: OutdatedEntry[] = [];

  for (const pkg of resolved.lock.packages) {
    const current = parseSemver(pkg.version);
    if (!current) {
      entries.push({ coordinate: pkg.name, current: pkg.version });
      continue;
    }

    try {
      const versions = await listRemoteVersions(pkg.name);
      const semvers = versions
        .map((v) => ({ version: v, parsed: parseSemver(v) }))
        .filter((v): v is { version: string; parsed: SemverParts } => v.parsed !== undefined)
        .filter((v) => !v.parsed.prerelease)
        .sort((a, b) => compareSemver(a.parsed, b.parsed));

      const latest = semvers.length > 0 ? semvers[semvers.length - 1] : undefined;
      const latestVersion = latest?.version;

      if (latestVersion && compareSemver(current, latest.parsed) < 0) {
        entries.push({
          coordinate: pkg.name,
          current: pkg.version,
          latest: latestVersion,
        });
      }
    } catch {
      // Network/config errors — skip this package
      entries.push({ coordinate: pkg.name, current: pkg.version });
    }
  }

  return { workspaceRoot, entries };
}
