import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PactiaConfig } from "../config/pactia-config.js";
import { loadPactiaConfig } from "../config/load-pactia-config.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";
import {
  HostArchiveKind,
  hostArchiveKind,
  remoteRefForCoordinate,
  type PackageRemoteRef,
} from "./package-registry.js";
import { parseSemver } from "./semver.js";
import { versionIndexCachePath } from "../vendor/cache-paths.js";

const VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

interface VersionCacheFile {
  readonly fetchedAt: string;
  readonly versions: readonly string[];
}

function resolveHostToken(token: string | undefined): string | undefined {
  const trimmed = token?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("env:")) {
    const envName = trimmed.slice("env:".length);
    return process.env[envName]?.trim() || undefined;
  }
  return trimmed;
}

function authHeaders(hostConfig: { readonly token?: string }): Readonly<Record<string, string>> {
  const token = resolveHostToken(hostConfig.token);
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function versionFromGitTag(tagName: string): string | undefined {
  const match = /^v(.+)$/.exec(tagName.trim());
  if (!match?.[1]) {
    return undefined;
  }
  return parseSemver(match[1]) ? match[1] : undefined;
}

function readVersionCache(coordinate: string): readonly string[] | undefined {
  const cachePath = versionIndexCachePath(coordinate);
  if (!existsSync(cachePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as VersionCacheFile;
    const fetchedAt = Date.parse(parsed.fetchedAt);
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > VERSION_CACHE_TTL_MS) {
      return undefined;
    }
    return parsed.versions;
  } catch {
    return undefined;
  }
}

function writeVersionCache(coordinate: string, versions: readonly string[]): void {
  const cachePath = versionIndexCachePath(coordinate);
  mkdirSync(dirname(cachePath), { recursive: true });
  const payload: VersionCacheFile = {
    fetchedAt: new Date().toISOString(),
    versions: [...versions].sort(),
  };
  writeFileSync(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function fetchGithubTags(
  remote: PackageRemoteRef,
  config: PactiaConfig,
): Promise<readonly string[]> {
  const hostConfig = config.hosts.get(remote.host);
  if (!hostConfig) {
    throw new ResolveError(
      ResolveErrorCode.ConfigMissing,
      `No [hosts."${remote.host}"] in ~/.pactia/config.toml`,
    );
  }

  const apiBase = hostConfig.api.replace(/\/$/, "");
  const url = `${apiBase}/repos/${remote.owner}/${remote.repo}/tags`;
  const response = await fetch(url, {
    headers: {
      ...authHeaders(hostConfig),
      Accept: "application/vnd.github+json",
      "User-Agent": "pactia",
    },
  });
  if (!response.ok) {
    throw new ResolveError(
      ResolveErrorCode.HttpFetchFailed,
      `GitHub tags API HTTP ${response.status} for ${remote.owner}/${remote.repo}`,
    );
  }

  const tags = (await response.json()) as readonly { readonly name?: string }[];
  const versions = tags
    .map((tag) => (tag.name ? versionFromGitTag(tag.name) : undefined))
    .filter((version): version is string => version !== undefined);
  return [...new Set(versions)];
}

async function fetchGitlabTags(
  remote: PackageRemoteRef,
  config: PactiaConfig,
): Promise<readonly string[]> {
  const hostConfig = config.hosts.get(remote.host);
  if (!hostConfig) {
    throw new ResolveError(
      ResolveErrorCode.ConfigMissing,
      `No [hosts."${remote.host}"] in ~/.pactia/config.toml`,
    );
  }

  const apiBase = hostConfig.api.replace(/\/$/, "");
  const project = encodeURIComponent(`${remote.owner}/${remote.repo}`);
  const url = `${apiBase}/projects/${project}/repository/tags`;
  const response = await fetch(url, {
    headers: {
      ...authHeaders(hostConfig),
      "User-Agent": "pactia",
    },
  });
  if (!response.ok) {
    throw new ResolveError(
      ResolveErrorCode.HttpFetchFailed,
      `GitLab tags API HTTP ${response.status} for ${remote.owner}/${remote.repo}`,
    );
  }

  const tags = (await response.json()) as readonly { readonly name?: string }[];
  const versions = tags
    .map((tag) => (tag.name ? versionFromGitTag(tag.name) : undefined))
    .filter((version): version is string => version !== undefined);
  return [...new Set(versions)];
}

async function fetchRemoteTags(
  remote: PackageRemoteRef,
  config: PactiaConfig,
): Promise<readonly string[]> {
  const kind = hostArchiveKind(remote.host, config);
  if (kind === HostArchiveKind.Gitlab) {
    return fetchGitlabTags(remote, config);
  }
  return fetchGithubTags(remote, config);
}

/** List remote versions for a coordinate (tags API + ~/.pactia/cache TTL). */
export async function listRemoteVersions(
  coordinate: string,
  config: PactiaConfig = loadPactiaConfig(),
): Promise<readonly string[]> {
  const cached = readVersionCache(coordinate);
  if (cached) {
    return cached;
  }

  const remote = remoteRefForCoordinate(coordinate, config);
  if (!remote) {
    return [];
  }

  const versions = await fetchRemoteTags(remote, config);
  writeVersionCache(coordinate, versions);
  return versions;
}
