import type { PactiaConfig, PactiaSourceConfig } from "../config/pactia-config.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";

export enum PackageRepoLayout {
  Root = "root",
  Subdir = "subdir",
}

export interface PackageGitSource {
  readonly url: string;
  readonly layout: PackageRepoLayout;
  readonly subdir?: string;
}

export interface PackageRemoteRef {
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  readonly subdir?: string;
}

export enum HostArchiveKind {
  Github = "github",
  Gitlab = "gitlab",
  Generic = "generic",
}

interface GoStyleCoordinate {
  readonly host: string;
  readonly org: string;
  readonly repo: string;
}

function parseGoStyleCoordinate(coordinate: string): GoStyleCoordinate | undefined {
  if (!coordinate.startsWith("@")) {
    return undefined;
  }
  const segments = coordinate.slice(1).split("/");
  if (segments.length < 3) {
    return undefined;
  }
  const host = segments[0];
  const org = segments[1];
  const repo = segments.slice(2).join("/");
  if (!host || !org || !repo) {
    return undefined;
  }
  return { host, org, repo };
}

function hostFromGitBase(gitBase: string): string | undefined {
  try {
    const url = new URL(gitBase.replace(/\/$/, ""));
    return url.host;
  } catch {
    return undefined;
  }
}

function ownerFromGitBase(gitBase: string): string | undefined {
  try {
    const url = new URL(gitBase.replace(/\/$/, ""));
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.at(-1);
  } catch {
    return undefined;
  }
}

export function hostArchiveKind(host: string, config: PactiaConfig): HostArchiveKind {
  if (host === "github.com") {
    return HostArchiveKind.Github;
  }
  if (host === "gitlab.com") {
    return HostArchiveKind.Gitlab;
  }
  const hostConfig = config.hosts.get(host);
  if (hostConfig?.api.includes("/api/v4")) {
    return HostArchiveKind.Gitlab;
  }
  return HostArchiveKind.Generic;
}

export function remoteRefForCoordinate(
  coordinate: string,
  config: PactiaConfig,
): PackageRemoteRef | undefined {
  const scoped = longestMatchingSourcePrefix(coordinate, config);
  if (scoped) {
    const suffix = coordinate.slice(scoped.prefix.length);
    if (suffix.length === 0 || suffix.includes("/")) {
      return undefined;
    }
    const host = hostFromGitBase(scoped.source.git);
    const owner = ownerFromGitBase(scoped.source.git);
    if (!host || !owner) {
      return undefined;
    }
    return {
      host,
      owner,
      repo: suffix,
      subdir: scoped.source.subdir,
    };
  }

  const goStyle = parseGoStyleCoordinate(coordinate);
  if (!goStyle) {
    return undefined;
  }

  if (!config.hosts.has(goStyle.host)) {
    throw new ResolveError(
      ResolveErrorCode.ConfigMissing,
      `No [hosts."${goStyle.host}"] in ~/.pactia/config.toml for coordinate '${coordinate}'`,
    );
  }

  return {
    host: goStyle.host,
    owner: goStyle.org,
    repo: goStyle.repo,
  };
}

function longestMatchingSourcePrefix(
  coordinate: string,
  config: PactiaConfig,
): { prefix: string; source: PactiaSourceConfig } | undefined {
  let best: { prefix: string; source: PactiaSourceConfig } | undefined;
  for (const [prefix, source] of config.sources) {
    if (!coordinate.startsWith(prefix)) {
      continue;
    }
    if (!best || prefix.length > best.prefix.length) {
      best = { prefix, source };
    }
  }
  return best;
}

/** Resolve git URL from ~/.pactia/config.toml only — no hardcoded hosts or scopes. */
export function gitSourceForCoordinate(
  coordinate: string,
  config: PactiaConfig,
): PackageGitSource | undefined {
  const scoped = longestMatchingSourcePrefix(coordinate, config);
  if (scoped) {
    const suffix = coordinate.slice(scoped.prefix.length);
    if (suffix.length === 0 || suffix.includes("/")) {
      return undefined;
    }
    const base = scoped.source.git.replace(/\/$/, "");
    return {
      url: `${base}/${suffix}.git`,
      layout: scoped.source.subdir ? PackageRepoLayout.Subdir : PackageRepoLayout.Root,
      subdir: scoped.source.subdir,
    };
  }

  const goStyle = parseGoStyleCoordinate(coordinate);
  if (!goStyle) {
    return undefined;
  }

  const hostConfig = config.hosts.get(goStyle.host);
  if (!hostConfig) {
    throw new ResolveError(
      ResolveErrorCode.ConfigMissing,
      `No [hosts."${goStyle.host}"] in ~/.pactia/config.toml for coordinate '${coordinate}'`,
    );
  }

  const base = hostConfig.git.replace(/\/$/, "");
  return {
    url: `${base}/${goStyle.org}/${goStyle.repo}.git`,
    layout: PackageRepoLayout.Root,
  };
}
