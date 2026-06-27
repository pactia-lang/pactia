import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { listRemoteVersions } from "../resolve/package-tags.js";
import { parseSemver, type SemverParts } from "../resolve/semver.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";
import { parsePactiaLock } from "@pactia/pactiac";

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

  const lockPath = join(workspaceRoot, "pactia.lock");
  const lockSource = readFileSync(lockPath, "utf8");
  const lock = parsePactiaLock(lockSource);
  const entries: OutdatedEntry[] = [];

  for (const pkg of lock.packages) {
    const current = parseSemver(pkg.version);
    if (!current) {
      entries.push({ coordinate: pkg.name, current: pkg.version });
      continue;
    }

    let latest: string | undefined;

    try {
      const versions = await listRemoteVersions(pkg.name);
      const semvers = versions
        .map((v) => ({ version: v, parsed: parseSemver(v) }))
        .filter((v): v is { version: string; parsed: SemverParts } => v.parsed !== undefined)
        .filter((v) => !v.parsed.prerelease)
        .sort((a, b) => compareSemver(a.parsed, b.parsed));

      const latestEntry = semvers.length > 0 ? semvers[semvers.length - 1] : undefined;
      if (latestEntry && compareSemver(current, latestEntry.parsed) < 0) {
        latest = latestEntry.version;
      }
    } catch {
      // Network/config errors — latest stays undefined
    }

    entries.push({
      coordinate: pkg.name,
      current: pkg.version,
      latest,
    });
  }

  return { workspaceRoot, entries };
}
