import type { PactiaLockManifest } from "@pactia/pactiac";

export interface ResolvedLock {
  readonly lock: PactiaLockManifest;
  readonly written: boolean;
  readonly fetched: readonly string[];
}
