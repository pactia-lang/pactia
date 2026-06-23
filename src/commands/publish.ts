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
