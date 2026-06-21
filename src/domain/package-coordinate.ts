import { ResolveError, ResolveErrorCode } from "./resolve-error.js";

const COORDINATE_PATTERN = /^@[\w-]+\/[\w-]+$/;

/** Normalize shorthand `rust-stack` to `@pactia/rust-stack`. */
export function normalizeCoordinate(input: string): string {
  const trimmed = input.trim();
  if (COORDINATE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (/^[\w-]+$/.test(trimmed)) {
    return `@pactia/${trimmed}`;
  }
  throw new ResolveError(
    ResolveErrorCode.InvalidCoordinate,
    `Invalid package coordinate '${input}' — expected @scope/name or a short name`,
  );
}

/** Vendored directory name: `@pactia/foo@1.0.0` → `@pactia--foo@1.0.0`. */
export function packageDirName(coordinate: string, version: string): string {
  return `${coordinate.replace(/\//g, "--")}@${version}`;
}
