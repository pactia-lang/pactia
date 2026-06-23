import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { hashDirectoryMarker } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { DownloadPrefer } from "../config/pactia-config.js";
import { loadPactiaConfig } from "../config/load-pactia-config.js";
import {
  gitSourceForCoordinate,
  PackageRepoLayout,
  remoteRefForCoordinate,
} from "../resolve/package-registry.js";
import { downloadHttpArchive } from "./http-archive.js";
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
  const source = gitSourceForCoordinate(coordinate, loadPactiaConfig());
  if (!source) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `No [source."…"] or [hosts."…"] entry in ~/.pactia/config.toml resolves '${coordinate}'`,
    );
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "pactia-install-"));
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
        `Installed '${coordinate}@${version}' is missing pactia.toml or index.pactia`,
      );
    }

    copyPackageTree(packageRoot, destDir);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function installPackageToDir(
  coordinate: string,
  version: string,
  destDir: string,
): Promise<void> {
  const config = loadPactiaConfig();
  const remote = remoteRefForCoordinate(coordinate, config);
  if (!remote) {
    throw new ResolveError(
      ResolveErrorCode.PackageNotFound,
      `No [source."…"] or [hosts."…"] entry in ~/.pactia/config.toml resolves '${coordinate}'`,
    );
  }

  if (config.prefer === DownloadPrefer.Http) {
    try {
      await downloadHttpArchive(remote, version, destDir, config);
      return;
    } catch (error) {
      if (
        error instanceof ResolveError &&
        error.code !== ResolveErrorCode.HttpFetchFailed &&
        error.code !== ResolveErrorCode.ManifestMissing
      ) {
        throw error;
      }
    }
  }

  cloneGitPackage(coordinate, version, destDir);
}

/** Ensure package exists in global cache; returns cache directory. */
export async function materializePackageCache(
  coordinate: string,
  version: string,
  localSourceDir?: string,
): Promise<string> {
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

  await installPackageToDir(coordinate, version, cacheDir);
  return cacheDir;
}

export function packageDigest(packageDir: string): string {
  return hashDirectoryMarker(packageDir);
}
