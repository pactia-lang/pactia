import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DownloadPrefer,
  type PactiaConfig,
  type PactiaHostConfig,
  type PactiaSourceConfig,
} from "./pactia-config.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

type ConfigSection = "none" | "source" | "hosts" | "defaults";

function parseSectionHeader(line: string): { section: ConfigSection; key?: string } {
  const sourceMatch = /^\[source\."(.+)"\]$/.exec(line);
  if (sourceMatch) {
    return { section: "source", key: sourceMatch[1] };
  }
  const hostMatch = /^\[hosts\."(.+)"\]$/.exec(line);
  if (hostMatch) {
    return { section: "hosts", key: hostMatch[1] };
  }
  if (line === "[defaults]") {
    return { section: "defaults" };
  }
  return { section: "none" };
}

export function parsePactiaConfig(source: string): PactiaConfig {
  const sources = new Map<string, PactiaSourceConfig>();
  const hosts = new Map<string, PactiaHostConfig>();
  let prefer = DownloadPrefer.Http;

  let section: ConfigSection = "none";
  let sectionKey: string | undefined;
  let draftSource: PactiaSourceConfig | undefined;
  let draftHost: PactiaHostConfig | undefined;

  function flushSource(): void {
    if (sectionKey && draftSource?.git) {
      sources.set(sectionKey, draftSource);
    }
    draftSource = undefined;
  }

  function flushHost(): void {
    if (sectionKey && draftHost?.git && draftHost.api) {
      hosts.set(sectionKey, draftHost);
    }
    draftHost = undefined;
  }

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    if (line.startsWith("[")) {
      flushSource();
      flushHost();
      const parsed = parseSectionHeader(line);
      section = parsed.section;
      sectionKey = parsed.key;
      if (section === "source") {
        draftSource = { git: "" };
      }
      if (section === "hosts") {
        draftHost = { git: "", api: "" };
      }
      continue;
    }

    const kv = /^([^=]+)=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const key = unquote(kv[1]!.trim());
    const value = unquote(kv[2]!.trim());

    if (section === "source" && draftSource) {
      if (key === "git") draftSource = { ...draftSource, git: value };
      if (key === "subdir") draftSource = { ...draftSource, subdir: value };
    } else if (section === "hosts" && draftHost) {
      if (key === "git") draftHost = { ...draftHost, git: value };
      if (key === "api") draftHost = { ...draftHost, api: value };
      if (key === "token") draftHost = { ...draftHost, token: value };
    } else if (section === "defaults" && key === "prefer") {
      prefer = value === DownloadPrefer.Git ? DownloadPrefer.Git : DownloadPrefer.Http;
    }
  }

  flushSource();
  flushHost();

  return { sources, hosts, prefer };
}

export function pactiaConfigPath(): string {
  const override = process.env["PACTIA_CONFIG"];
  if (override) {
    return override;
  }
  return join(homedir(), ".pactia", "config.toml");
}

export function loadPactiaConfig(configPath: string = pactiaConfigPath()): PactiaConfig {
  let source: string;
  try {
    source = readFileSync(configPath, "utf8");
  } catch {
    throw new ResolveError(
      ResolveErrorCode.ConfigMissing,
      `Missing ${configPath} — copy pactia/config/config.example.toml to ~/.pactia/config.toml`,
    );
  }
  return parsePactiaConfig(source);
}
