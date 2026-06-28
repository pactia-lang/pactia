import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePackageToml } from "@pactia/pactiac";
import { isValidCoordinate } from "../domain/package-coordinate.js";
import { parseSemver } from "../resolve/semver.js";

export enum PublishValidationCode {
  ManifestMissing = "MANIFEST_MISSING",
  IndexMissing = "INDEX_MISSING",
  InvalidName = "INVALID_NAME",
  InvalidVersion = "INVALID_VERSION",
  IndexHeaderMissing = "INDEX_HEADER_MISSING",
  ConstantDefRequired = "CONSTANT_DEF_REQUIRED",
  ManifestFileMissing = "MANIFEST_FILE_MISSING",
  ManifestFileEmpty = "MANIFEST_FILE_EMPTY",
  MixedExportsMissing = "MIXED_EXPORTS_MISSING",
}

export interface PublishValidationIssue {
  readonly code: PublishValidationCode;
  readonly message: string;
}

export interface PublishDryRunResult {
  readonly packageRoot: string;
  readonly name: string;
  readonly version: string;
  readonly ok: boolean;
  readonly issues: readonly PublishValidationIssue[];
}

export function validatePublishPackage(packageRootInput: string): PublishDryRunResult {
  const packageRoot = resolve(packageRootInput);
  const issues: PublishValidationIssue[] = [];

  const manifestPath = join(packageRoot, "pactia.toml");
  const indexPath = join(packageRoot, "index.pactia");

  if (!existsSync(manifestPath)) {
    issues.push({
      code: PublishValidationCode.ManifestMissing,
      message: "pactia.toml is missing",
    });
  }

  if (!existsSync(indexPath)) {
    issues.push({
      code: PublishValidationCode.IndexMissing,
      message: "index.pactia is missing",
    });
  }

  if (issues.length > 0) {
    return {
      packageRoot,
      name: "@unknown/package",
      version: "0.0.0",
      ok: false,
      issues,
    };
  }

  const manifest = parsePackageToml(readFileSync(manifestPath, "utf8"));
  if (!isValidCoordinate(manifest.name)) {
    issues.push({
      code: PublishValidationCode.InvalidName,
      message: `package name '${manifest.name}' is not a valid coordinate`,
    });
  }

  if (!parseSemver(manifest.version)) {
    issues.push({
      code: PublishValidationCode.InvalidVersion,
      message: `package version '${manifest.version}' is not valid semver`,
    });
  }

  const indexSource = readFileSync(indexPath, "utf8");
  const firstMeaningful = indexSource
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("//"));
  if (!firstMeaningful?.startsWith("pactia ")) {
    issues.push({
      code: PublishValidationCode.IndexHeaderMissing,
      message: "index.pactia must start with a pactia version line (e.g. pactia 1.0)",
    });
  }

  // Validate constant syntax: warn on bare `export name = value` without `def`
  const bareConstantPattern = /^export\s+(?!def\b)(?!module\b)(?!service\b)(?!model\b)(?!context\b)\w+\s*=/m;
  if (bareConstantPattern.test(indexSource)) {
    issues.push({
      code: PublishValidationCode.ConstantDefRequired,
      message: "index.pactia contains 'export name = value' without 'def' — use 'export def name = value'",
    });
  }

  // Validate topology manifest files
  const manifestPattern = /^export\s+["']([^"']+)["']/gm;
  const hasDefExports = /^export\s+def\s/m.test(indexSource);
  const hasTopologyInline = /^export\s+(module|service|model|context)\s+\w+\s*\{/m.test(indexSource);

  // Collect all manifest file references
  const manifestFiles: string[] = [];
  let manifestMatch: RegExpExecArray | null;
  while ((manifestMatch = manifestPattern.exec(indexSource)) !== null) {
    manifestFiles.push(manifestMatch[1]!);
  }
  const hasManifestExports = manifestFiles.length > 0;

  // Check mixed-exports opt-in
  if (hasDefExports && (hasManifestExports || hasTopologyInline) && !manifest.mixedExports) {
    issues.push({
      code: PublishValidationCode.MixedExportsMissing,
      message: "index.pactia has both registry defs and topology exports — add 'mixed-exports = true' to pactia.toml [package]",
    });
  }

  // Validate each manifest file exists and has content
  for (const filePath of manifestFiles) {
    const fullPath = join(packageRoot, filePath);
    if (!existsSync(fullPath)) {
      issues.push({
        code: PublishValidationCode.ManifestFileMissing,
        message: `Manifest file '${filePath}' referenced in index.pactia does not exist`,
      });
    } else {
      const content = readFileSync(fullPath, "utf8").trim();
      if (!content) {
        issues.push({
          code: PublishValidationCode.ManifestFileEmpty,
          message: `Manifest file '${filePath}' is empty`,
        });
      }
    }
  }

  return {
    packageRoot,
    name: manifest.name,
    version: manifest.version,
    ok: issues.length === 0,
    issues,
  };
}

export interface PublishOptions {
  readonly packageRoot?: string;
  readonly dryRun: boolean;
}

export interface PublishResult {
  readonly packageRoot: string;
  readonly name: string;
  readonly version: string;
  readonly ok: boolean;
}

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export function runPublish(options: PublishOptions): PublishResult {
  if (!options.dryRun) {
    throw new PublishError(
      "Only publish --dry-run is supported; release with git tag v{version} && git push",
    );
  }

  const packageRoot = resolve(options.packageRoot ?? process.cwd());
  const result = validatePublishPackage(packageRoot);
  if (!result.ok) {
    const message = result.issues.map((issue) => issue.message).join("; ");
    throw new PublishError(message);
  }

  return {
    packageRoot: result.packageRoot,
    name: result.name,
    version: result.version,
    ok: true,
  };
}
