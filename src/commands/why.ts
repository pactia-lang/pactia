import { resolve } from "node:path";
import { normalizeCoordinate } from "../domain/package-coordinate.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import {
  buildLockDependencyGraph,
  dependencyChainToTarget,
  formatWhyChain,
} from "../resolve/dependency-graph.js";
import { installLockedPackages } from "../resolve/lock-resolver.js";
import { ensureVendoredPackages } from "../vendor/ensure-vendored.js";
import { findWorkspaceRoot, WorkspaceError } from "../workspace/find-workspace.js";

export interface WhyOptions {
  readonly workspaceRoot?: string;
  readonly coordinate: string;
}

export interface WhyResult {
  readonly workspaceRoot: string;
  readonly coordinate: string;
  readonly output: string;
}

export class WhyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhyError";
  }
}

export async function runWhy(options: WhyOptions): Promise<WhyResult> {
  let workspaceRoot: string;
  try {
    workspaceRoot = options.workspaceRoot
      ? resolve(options.workspaceRoot)
      : findWorkspaceRoot();
  } catch (error) {
    throw error instanceof WorkspaceError ? new WhyError(error.message) : error;
  }

  const coordinate = normalizeCoordinate(options.coordinate);
  const resolved = await installLockedPackages(workspaceRoot);

  // Ensure vendored packages exist before building the dependency graph
  // so that transitive dependency edges are complete (GAP-PM-051)
  if (resolved.lock.packages.length > 0) {
    ensureVendoredPackages(workspaceRoot, resolved.lock);
  }

  const graph = buildLockDependencyGraph(workspaceRoot, resolved.lock);
  const chain = dependencyChainToTarget(graph, coordinate);

  if (!chain) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `'${coordinate}' is not in the lockfile dependency graph for this workspace`,
    );
  }

  return {
    workspaceRoot,
    coordinate,
    output: formatWhyChain(graph, chain),
  };
}
