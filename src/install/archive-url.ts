import type { PactiaConfig, PactiaHostConfig } from "../config/pactia-config.js";
import {
  HostArchiveKind,
  hostArchiveKind,
  type PackageRemoteRef,
} from "../resolve/package-registry.js";

export interface ArchiveDownload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

function resolveHostToken(hostConfig: PactiaHostConfig): string | undefined {
  const token = hostConfig.token?.trim();
  if (!token) {
    return undefined;
  }
  if (token.startsWith("env:")) {
    const envName = token.slice("env:".length);
    return process.env[envName]?.trim() || undefined;
  }
  return token;
}

function authHeaders(hostConfig: PactiaHostConfig): Readonly<Record<string, string>> {
  const token = resolveHostToken(hostConfig);
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

/** Build HTTP archive URL and headers from config — no hardcoded hosts. */
export function archiveDownloadForRef(
  remote: PackageRemoteRef,
  version: string,
  config: PactiaConfig,
): ArchiveDownload | undefined {
  const hostConfig = config.hosts.get(remote.host);
  if (!hostConfig) {
    return undefined;
  }

  const tag = `v${version}`;
  const kind = hostArchiveKind(remote.host, config);
  const gitBase = hostConfig.git.replace(/\/$/, "");
  const headers = authHeaders(hostConfig);

  if (kind === HostArchiveKind.Github) {
    return {
      url: `${gitBase}/${remote.owner}/${remote.repo}/archive/refs/tags/${tag}.tar.gz`,
      headers: {
        ...headers,
        Accept: "application/vnd.github+json",
        "User-Agent": "pactia",
      },
    };
  }

  if (kind === HostArchiveKind.Gitlab) {
    const apiBase = hostConfig.api.replace(/\/$/, "");
    const project = encodeURIComponent(`${remote.owner}/${remote.repo}`);
    return {
      url: `${apiBase}/projects/${project}/repository/archive.tar.gz?sha=${tag}`,
      headers: {
        ...headers,
        "User-Agent": "pactia",
      },
    };
  }

  return {
    url: `${gitBase}/${remote.owner}/${remote.repo}/archive/refs/tags/${tag}.tar.gz`,
    headers: {
      ...headers,
      "User-Agent": "pactia",
    },
  };
}
