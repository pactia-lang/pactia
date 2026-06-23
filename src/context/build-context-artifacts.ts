import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import type { PactiaLockManifest } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { workspaceVendorDir } from "../vendor/cache-paths.js";
import {
  CONTEXT_FILE_ERROR_THRESHOLD,
  CONTEXT_FILE_WARN_THRESHOLD,
  type ContextIndexDocument,
  type ContextIndexEntry,
  type ContextIrEntry,
  type ContextIndexedFile,
} from "./types.js";
import {
  CONTEXT_BUNDLE_DIR,
  bundleContextPath,
  bundleContextPathValue,
  normalizeRelativePath,
} from "./bundle-context-path.js";
import { rewriteBundledContextInValue } from "./rewrite-bundled-context.js";

export class ContextBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextBuildError";
  }
}

export interface BuildContextArtifactsOptions {
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly lock: PactiaLockManifest;
  readonly bundleContext: boolean;
}

export interface BuildContextArtifactsResult {
  readonly indexPath: string;
  readonly bundledFiles: readonly string[];
  readonly rewrittenIrPaths: readonly string[];
  readonly warnings: readonly string[];
}

interface ResolvedContextFile {
  readonly sourcePath: string;
  readonly displayPath: string;
}

export function buildContextArtifacts(
  options: BuildContextArtifactsOptions,
): BuildContextArtifactsResult {
  const workspaceRoot = resolve(options.workspaceRoot);
  const outputDir = resolve(options.outputDir);
  const inputDir = join(outputDir, "input");
  const warnings: string[] = [];
  const entries: ContextIndexEntry[] = [];
  const bundledFiles: string[] = [];
  const rewrittenIrPaths: string[] = [];

  for (const { irPath, scope } of listIrJsonFiles(inputDir)) {
    const source = readFileSync(irPath, "utf8");
    const parsed = JSON.parse(source) as Record<string, unknown>;
    const contexts = extractContextEntries(parsed);
    if (contexts.length === 0) {
      continue;
    }

    for (const contextEntry of contexts) {
      const files = resolveContextFiles(workspaceRoot, options.lock, contextEntry);
      if (files.length > CONTEXT_FILE_WARN_THRESHOLD) {
        warnings.push(
          `context '${contextEntry.id}' in scope '${scope}' includes ${files.length} files (warn threshold ${CONTEXT_FILE_WARN_THRESHOLD})`,
        );
      }
      if (files.length > CONTEXT_FILE_ERROR_THRESHOLD) {
        throw new ContextBuildError(
          `context '${contextEntry.id}' in scope '${scope}' includes ${files.length} files (limit ${CONTEXT_FILE_ERROR_THRESHOLD})`,
        );
      }

      const indexedFiles: ContextIndexedFile[] = files.map((file) => ({
        path: options.bundleContext ? bundleContextPath(file.displayPath) : file.displayPath,
        digest: sha256File(file.sourcePath),
      }));

      if (options.bundleContext) {
        for (const file of files) {
          const bundleTarget = join(outputDir, "input", CONTEXT_BUNDLE_DIR, file.displayPath);
          mkdirSync(join(bundleTarget, ".."), { recursive: true });
          copyFileSync(file.sourcePath, bundleTarget);
          bundledFiles.push(relative(outputDir, bundleTarget));
        }
      }

      const indexPathValue = options.bundleContext
        ? bundleContextPathValue(contextEntry.path)
        : contextEntry.path;

      entries.push({
        id: contextEntry.id,
        scope,
        path: indexPathValue,
        files: indexedFiles,
        ...(contextEntry.guidance ? { guidance: [...contextEntry.guidance] } : {}),
        ...(!options.bundleContext && contextEntry.package ? { package: contextEntry.package } : {}),
      });
    }
  }

  if (options.bundleContext) {
    for (const irPath of listIrJsonPaths(inputDir, { includeWorkspace: true })) {
      const source = readFileSync(irPath, "utf8");
      if (!source.includes('"context"')) {
        continue;
      }
      const parsed = JSON.parse(source) as unknown;
      const rewritten = rewriteBundledContextInValue(parsed);
      writeFileSync(irPath, `${JSON.stringify(rewritten, null, 2)}\n`, "utf8");
      rewrittenIrPaths.push(relative(outputDir, irPath));
    }
  }

  const indexPath = join(outputDir, "input", "context.index.json");
  const document: ContextIndexDocument = { entries };
  writeFileSync(indexPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return {
    indexPath: relative(outputDir, indexPath),
    bundledFiles,
    rewrittenIrPaths,
    warnings,
  };
}

function listIrJsonFiles(inputDir: string): Array<{ irPath: string; scope: string }> {
  return listIrJsonPaths(inputDir, { includeWorkspace: false }).map((irPath) => ({
    irPath,
    scope: irScopeFromPath(irPath),
  }));
}

function listIrJsonPaths(
  inputDir: string,
  options: { readonly includeWorkspace: boolean },
): string[] {
  if (!existsSync(inputDir)) {
    return [];
  }

  const results: string[] = [];
  if (options.includeWorkspace) {
    const workspacePath = join(inputDir, "workspace.json");
    if (existsSync(workspacePath)) {
      results.push(workspacePath);
    }
  }

  const productPath = join(inputDir, "product.json");
  if (existsSync(productPath)) {
    results.push(productPath);
  }

  const modulesDir = join(inputDir, "modules");
  if (!existsSync(modulesDir)) {
    return results;
  }

  for (const moduleName of readdirSync(modulesDir)) {
    const moduleDir = join(modulesDir, moduleName);
    const moduleJson = join(moduleDir, `${moduleName}.module.json`);
    if (existsSync(moduleJson)) {
      results.push(moduleJson);
    }
    const modelJson = join(moduleDir, `${moduleName}.model.json`);
    if (existsSync(modelJson)) {
      results.push(modelJson);
    }
    const servicesDir = join(moduleDir, "services");
    if (!existsSync(servicesDir)) {
      continue;
    }
    for (const serviceFile of readdirSync(servicesDir)) {
      if (!serviceFile.endsWith(".service.json")) {
        continue;
      }
      results.push(join(servicesDir, serviceFile));
    }
  }

  return results;
}

function irScopeFromPath(irPath: string): string {
  const normalized = irPath.replace(/\\/g, "/");
  if (normalized.endsWith("/product.json")) {
    return "product";
  }
  if (normalized.endsWith("/workspace.json")) {
    return "workspace";
  }
  const moduleMatch = /\/modules\/([^/]+)\/\1\.module\.json$/.exec(normalized);
  if (moduleMatch) {
    return `module/${moduleMatch[1]}`;
  }
  const modelMatch = /\/modules\/([^/]+)\/\1\.model\.json$/.exec(normalized);
  if (modelMatch) {
    return `model/${modelMatch[1]}`;
  }
  const serviceMatch = /\/modules\/([^/]+)\/services\/([^/]+)\.service\.json$/.exec(normalized);
  if (serviceMatch) {
    return `service/${serviceMatch[1]}/${serviceMatch[2]}`;
  }
  return "unknown";
}

function extractContextEntries(slice: Record<string, unknown>): ContextIrEntry[] {
  const contexts: ContextIrEntry[] = [];
  for (const value of Object.values(slice)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const record = value as Record<string, unknown>;
    const rawContext = record["context"];
    if (!Array.isArray(rawContext)) {
      continue;
    }
    for (const item of rawContext) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const entry = item as Record<string, unknown>;
      const id = entry["id"];
      const path = entry["path"];
      if (typeof id !== "string" || (typeof path !== "string" && !Array.isArray(path))) {
        continue;
      }
      const guidance = Array.isArray(entry["guidance"])
        ? entry["guidance"].filter((line): line is string => typeof line === "string")
        : undefined;
      const pkg = typeof entry["package"] === "string" ? entry["package"] : undefined;
      contexts.push({ id, path, guidance, package: pkg });
    }
  }
  return contexts;
}

function resolveContextFiles(
  workspaceRoot: string,
  lock: PactiaLockManifest,
  entry: ContextIrEntry,
): ResolvedContextFile[] {
  const paths = Array.isArray(entry.path) ? entry.path : [entry.path];
  const resolved: ResolvedContextFile[] = [];

  for (const authoredPath of paths) {
    const root = entry.package
      ? packageRootForCoordinate(workspaceRoot, lock, entry.package)
      : workspaceRoot;
    const absolute = resolve(root, normalizeRelativePath(authoredPath));
    if (!existsSync(absolute)) {
      throw new ContextBuildError(`context '${entry.id}' path does not exist: ${authoredPath}`);
    }
    resolved.push(...expandContextPath(absolute, authoredPath));
  }

  return resolved;
}

function packageRootForCoordinate(
  workspaceRoot: string,
  lock: PactiaLockManifest,
  coordinate: string,
): string {
  const lockEntry = lock.packages.find((pkg) => pkg.name === coordinate);
  if (!lockEntry) {
    throw new ContextBuildError(`context package '${coordinate}' is missing from pactia.lock`);
  }
  return join(workspaceVendorDir(workspaceRoot), packageDirName(coordinate, lockEntry.version));
}

function expandContextPath(absolutePath: string, displayPath: string): ResolvedContextFile[] {
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new ContextBuildError(`context path must not be a symlink: ${displayPath}`);
  }
  if (stat.isFile()) {
    return [{ sourcePath: absolutePath, displayPath: normalizeRelativePath(displayPath) }];
  }
  if (!stat.isDirectory()) {
    throw new ContextBuildError(`context path is not a file or directory: ${displayPath}`);
  }

  const files: ResolvedContextFile[] = [];
  walkDirectory(absolutePath, displayPath, files);
  if (files.length === 0) {
    throw new ContextBuildError(`context directory is empty: ${displayPath}`);
  }
  return files;
}

function walkDirectory(
  absoluteDir: string,
  displayDir: string,
  files: ResolvedContextFile[],
): void {
  for (const name of readdirSync(absoluteDir)) {
    if (name.startsWith(".")) {
      continue;
    }
    const absolutePath = join(absoluteDir, name);
    const displayPath = join(displayDir, name).replace(/\\/g, "/");
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      walkDirectory(absolutePath, displayPath, files);
      continue;
    }
    if (stat.isFile()) {
      files.push({ sourcePath: absolutePath, displayPath: normalizeRelativePath(displayPath) });
    }
  }
}

function sha256File(path: string): string {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return `sha256:${digest}`;
}
