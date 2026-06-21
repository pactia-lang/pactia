import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { hashDirectoryMarker } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { gitSourceForCoordinate, PackageRepoLayout } from "../resolve/package-registry.js";
import { globalPackageCacheDir } from "../vendor/cache-paths.js";

function isPackageDir(dir: string): boolean {
  return (
    existsSync(join(dir, "pactia.toml")) || existsSync(join(dir, "index.pactia"))
  );
}

function copyPackageTree(sourceDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  cpSync(sourceDir, destDir, { recursive: true });
}

function cloneGitPackage(
  coordinate: string,
  version: string,
  destDir: string,
): void {
  const source = gitSourceForCoordinate(coordinate);
  if (!source) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `No git source registered for '${coordinate}'`,
    );
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "pactia-fetch-"));
  const tag = `v${version}`;
  try {
    const cloneResult = spawnSync(
      "git",
      ["clone", "--depth", "1", "--branch", tag, source.url, tmpRoot],
      { encoding: "utf8" },
    );
    if (cloneResult.status !== 0) {
      throw new ResolveError(
        ResolveErrorCode.GitFetchFailed,
        `git clone failed for '${coordinate}@${version}' (${tag}): ${cloneResult.stderr || cloneResult.stdout}`,
      );
    }

    const packageRoot =
      source.layout === PackageRepoLayout.Subdir && source.subdir
        ? join(tmpRoot, source.subdir)
        : tmpRoot;

    if (!isPackageDir(packageRoot)) {
      throw new ResolveError(
        ResolveErrorCode.ManifestMissing,
        `Fetched '${coordinate}@${version}' is missing pactia.toml or index.pactia`,
      );
    }

    copyPackageTree(packageRoot, destDir);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

/** Ensure package exists in global cache; returns cache directory. */
export function materializePackageCache(
  coordinate: string,
  version: string,
  localSourceDir?: string,
): string {
  const cacheDir = join(
    globalPackageCacheDir(),
    packageDirName(coordinate, version),
  );

  if (isPackageDir(cacheDir)) {
    return cacheDir;
  }

  mkdirSync(globalPackageCacheDir(), { recursive: true });

  if (localSourceDir && isPackageDir(localSourceDir)) {
    copyPackageTree(localSourceDir, cacheDir);
    return cacheDir;
  }

  cloneGitPackage(coordinate, version, cacheDir);
  return cacheDir;
}

export function packageDigest(packageDir: string): string {
  return hashDirectoryMarker(packageDir);
}
