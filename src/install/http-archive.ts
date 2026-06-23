import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { PactiaConfig } from "../config/pactia-config.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import { archiveDownloadForRef } from "./archive-url.js";
import type { PackageRemoteRef } from "../resolve/package-registry.js";

function isPackageDir(dir: string): boolean {
  return (
    existsSync(join(dir, "pactia.toml")) || existsSync(join(dir, "index.pactia"))
  );
}

function copyPackageTree(sourceDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  cpSync(sourceDir, destDir, { recursive: true });
}

async function downloadToFile(
  url: string,
  headers: Readonly<Record<string, string>>,
  destPath: string,
): Promise<void> {
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new ResolveError(
      ResolveErrorCode.HttpFetchFailed,
      `HTTP ${response.status} downloading archive from ${url}`,
    );
  }

  await pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    createWriteStream(destPath),
  );
}

function extractTarball(archivePath: string, extractDir: string): void {
  mkdirSync(extractDir, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", extractDir], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new ResolveError(
      ResolveErrorCode.HttpFetchFailed,
      `Failed to extract archive: ${result.stderr || result.stdout}`,
    );
  }
}

function findExtractedPackageRoot(extractDir: string, subdir?: string): string {
  if (subdir) {
    const nested = join(extractDir, subdir);
    if (isPackageDir(nested)) {
      return nested;
    }
  }

  const entries = readdirSync(extractDir);
  if (entries.length === 1) {
    const nested = join(extractDir, entries[0]!);
    if (isPackageDir(nested)) {
      return nested;
    }
  }

  if (isPackageDir(extractDir)) {
    return extractDir;
  }

  for (const entry of entries) {
    const candidate = join(extractDir, entry);
    if (isPackageDir(candidate)) {
      return candidate;
    }
  }

  throw new ResolveError(
    ResolveErrorCode.ManifestMissing,
    "Downloaded archive is missing pactia.toml or index.pactia",
  );
}

export async function downloadHttpArchive(
  remote: PackageRemoteRef,
  version: string,
  destDir: string,
  config: PactiaConfig,
): Promise<void> {
  const download = archiveDownloadForRef(remote, version, config);
  if (!download) {
    throw new ResolveError(
      ResolveErrorCode.HttpFetchFailed,
      `No [hosts."${remote.host}"] in ~/.pactia/config.toml for HTTP archive download`,
    );
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "pactia-http-"));
  const archivePath = join(tmpRoot, "archive.tar.gz");
  const extractDir = join(tmpRoot, "extract");

  try {
    await downloadToFile(download.url, download.headers, archivePath);
    extractTarball(archivePath, extractDir);
    const packageRoot = findExtractedPackageRoot(extractDir, remote.subdir);
    copyPackageTree(packageRoot, destDir);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}
