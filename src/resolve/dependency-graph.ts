import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePackageToml, type PactiaLockManifest } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { packageSearchRoots } from "../vendor/cache-paths.js";
import { parseWorkspaceToml } from "./workspace-toml.js";

export interface LockDependencyGraph {
  readonly workspaceName: string;
  readonly directDependencies: readonly string[];
  readonly edges: ReadonlyMap<string, readonly string[]>;
  readonly versions: ReadonlyMap<string, string>;
}

function packageDirForLockEntry(
  workspaceRoot: string,
  coordinate: string,
  version: string,
): string | undefined {
  const dirName = packageDirName(coordinate, version);
  for (const root of packageSearchRoots(workspaceRoot)) {
    const candidate = join(root, dirName);
    if (existsSync(join(candidate, "pactia.toml"))) {
      return candidate;
    }
  }
  return undefined;
}

function readPackageDependencies(packageDir: string): readonly string[] {
  const manifestPath = join(packageDir, "pactia.toml");
  if (!existsSync(manifestPath)) {
    return [];
  }
  return [...parsePackageToml(readFileSync(manifestPath, "utf8")).dependencies.keys()];
}

export function buildLockDependencyGraph(
  workspaceRoot: string,
  lock: PactiaLockManifest,
): LockDependencyGraph {
  const workspace = parseWorkspaceToml(
    readFileSync(join(workspaceRoot, "pactia.toml"), "utf8"),
  );
  const edges = new Map<string, string[]>();
  const versions = new Map<string, string>();

  for (const entry of lock.packages) {
    versions.set(entry.name, entry.version);
    const packageDir = packageDirForLockEntry(workspaceRoot, entry.name, entry.version);
    const deps = packageDir ? [...readPackageDependencies(packageDir)] : [];
    edges.set(entry.name, deps);
  }

  return {
    workspaceName: workspace.name,
    directDependencies: [...workspace.dependencies.keys()],
    edges,
    versions,
  };
}

/** Shortest chain from a workspace direct dependency down to `target`. */
export function dependencyChainToTarget(
  graph: LockDependencyGraph,
  target: string,
): readonly string[] | undefined {
  if (!graph.versions.has(target)) {
    return undefined;
  }

  if (graph.directDependencies.includes(target)) {
    return [target];
  }

  const queue = [...graph.directDependencies];
  const cameFrom = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dep of graph.edges.get(current) ?? []) {
      if (cameFrom.has(dep)) {
        continue;
      }
      cameFrom.set(dep, current);
      if (dep === target) {
        const chain: string[] = [target];
        let node: string | undefined = target;
        while (node && cameFrom.has(node)) {
          node = cameFrom.get(node);
          if (node) {
            chain.push(node);
          }
        }
        return chain.reverse();
      }
      queue.push(dep);
    }
  }

  return undefined;
}

export function formatWhyChain(
  graph: LockDependencyGraph,
  chain: readonly string[],
): string {
  const target = chain.at(-1)!;
  const lines: string[] = [`${target} ${graph.versions.get(target) ?? "?"}`];

  for (let index = chain.length - 2; index >= 0; index -= 1) {
    const coordinate = chain[index]!;
    const depth = chain.length - 1 - index;
    const prefix = `${"    ".repeat(depth - 1)}└── `;
    lines.push(`${prefix}${coordinate} ${graph.versions.get(coordinate) ?? "?"}`);
  }

  const workspacePrefix = `${"    ".repeat(chain.length - 1)}└── `;
  lines.push(`${workspacePrefix}${graph.workspaceName} (workspace)`);
  return lines.join("\n");
}
