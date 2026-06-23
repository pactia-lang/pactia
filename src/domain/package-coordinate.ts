import { ResolveError, ResolveErrorCode } from "./resolve-error.js";

/** `@scope/name` — e.g. `@pactia/kernel`, `@acme/rules` */
const SCOPE_COORDINATE_PATTERN = /^@[\w-]+\/[\w-]+$/;

/** `@{host}/{org}/{repo}` — e.g. `@github.com/acme/fleet-rules` */
const HOST_PATH_COORDINATE_PATTERN = /^@[\w.-]+\/[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*$/;

/** Two-segment coords using these scopes are ambiguous (use full @host/org/repo). */
enum AmbiguousScopeSegment {
  Github = "github",
  Gitlab = "gitlab",
}

function parseCoordinateSegments(coordinate: string): readonly string[] | undefined {
  if (!coordinate.startsWith("@")) {
    return undefined;
  }
  const segments = coordinate
    .slice(1)
    .split("/")
    .filter((segment) => segment.length > 0);
  return segments.length > 0 ? segments : undefined;
}

function isAmbiguousScopeCoordinate(coordinate: string): boolean {
  const segments = parseCoordinateSegments(coordinate);
  if (!segments || segments.length !== 2) {
    return false;
  }
  const [scope] = segments;
  if (!scope) {
    return false;
  }
  if (scope.includes(".")) {
    return true;
  }
  return (
    scope === AmbiguousScopeSegment.Github || scope === AmbiguousScopeSegment.Gitlab
  );
}

export enum PackageCoordinateStyle {
  Scope = "scope",
  HostPath = "host_path",
}

export function coordinateStyle(coordinate: string): PackageCoordinateStyle | undefined {
  const trimmed = coordinate.trim();
  if (isAmbiguousScopeCoordinate(trimmed)) {
    return undefined;
  }
  if (SCOPE_COORDINATE_PATTERN.test(trimmed)) {
    return PackageCoordinateStyle.Scope;
  }
  if (HOST_PATH_COORDINATE_PATTERN.test(trimmed)) {
    return PackageCoordinateStyle.HostPath;
  }
  return undefined;
}

export function isValidCoordinate(input: string): boolean {
  return coordinateStyle(input) !== undefined;
}

/**
 * Normalize CLI / toml coordinate input.
 * - Full coordinates pass through (`@pactia/kernel`, `@github.com/org/repo`).
 * - Short names expand to `@pactia/{name}`.
 */
export function normalizeCoordinate(input: string): string {
  const trimmed = input.trim();
  const style = coordinateStyle(trimmed);
  if (style !== undefined) {
    return trimmed;
  }
  if (/^[\w-]+$/.test(trimmed)) {
    return `@pactia/${trimmed}`;
  }
  throw new ResolveError(
    ResolveErrorCode.InvalidCoordinate,
    `Invalid package coordinate '${input}' — expected @scope/name, @host/org/repo, or a short name`,
  );
}

/** Vendored directory name: `@pactia/foo@1.0.0` → `@pactia--foo@1.0.0`. */
export function packageDirName(coordinate: string, version: string): string {
  return `${coordinate.replace(/\//g, "--")}@${version}`;
}
