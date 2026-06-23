export enum ResolveErrorCode {
  ConfigMissing = "CONFIG_MISSING",
  PackageNotFound = "PACKAGE_NOT_FOUND",
  VersionNotFound = "VERSION_NOT_FOUND",
  InvalidCoordinate = "INVALID_COORDINATE",
  GitFetchFailed = "GIT_FETCH_FAILED",
  HttpFetchFailed = "HTTP_FETCH_FAILED",
  ManifestMissing = "MANIFEST_MISSING",
  LockMissing = "LOCK_MISSING",
  LockStale = "LOCK_STALE",
  LockDigestMismatch = "LOCK_DIGEST_MISMATCH",
}

export class ResolveError extends Error {
  constructor(
    public readonly code: ResolveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResolveError";
  }
}
