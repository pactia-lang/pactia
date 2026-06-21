export enum ResolveErrorCode {
  PackageNotFound = "PACKAGE_NOT_FOUND",
  VersionNotFound = "VERSION_NOT_FOUND",
  InvalidCoordinate = "INVALID_COORDINATE",
  GitFetchFailed = "GIT_FETCH_FAILED",
  ManifestMissing = "MANIFEST_MISSING",
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
