import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DownloadPrefer } from "../config/pactia-config.js";
import { archiveDownloadForRef } from "./archive-url.js";
import { HostArchiveKind } from "../resolve/package-registry.js";

function testConfig() {
  return {
    sources: new Map(),
    hosts: new Map([
      [
        "github.com",
        {
          git: "https://github.com",
          api: "https://api.github.com",
          token: "env:PACTIA_GITHUB_TOKEN",
        },
      ],
      [
        "gitlab.com",
        {
          git: "https://gitlab.com",
          api: "https://gitlab.com/api/v4",
          token: "env:PACTIA_GITLAB_TOKEN",
        },
      ],
    ]),
    prefer: DownloadPrefer.Http,
  };
}

describe("archiveDownloadForRef", () => {
  it("builds GitHub archive URLs from config", () => {
    const download = archiveDownloadForRef(
      { host: "github.com", owner: "acme", repo: "fleet-rules" },
      "1.0.0",
      testConfig(),
    );
    assert.equal(
      download?.url,
      "https://github.com/acme/fleet-rules/archive/refs/tags/v1.0.0.tar.gz",
    );
    assert.equal(download?.headers.Accept, "application/vnd.github+json");
  });

  it("builds GitLab archive URLs from config", () => {
    const download = archiveDownloadForRef(
      { host: "gitlab.com", owner: "acme", repo: "fleet-rules" },
      "1.0.0-beta.1",
      testConfig(),
    );
    assert.equal(
      download?.url,
      "https://gitlab.com/api/v4/projects/acme%2Ffleet-rules/repository/archive.tar.gz?sha=v1.0.0-beta.1",
    );
  });
});

describe("hostArchiveKind", () => {
  it("detects GitLab-compatible hosts from api path", async () => {
    const { hostArchiveKind } = await import("../resolve/package-registry.js");
    const config = {
      ...testConfig(),
      hosts: new Map([
        [
          "git.example.com",
          {
            git: "https://git.example.com",
            api: "https://git.example.com/api/v4",
          },
        ],
      ]),
    };
    assert.equal(
      hostArchiveKind("git.example.com", config),
      HostArchiveKind.Gitlab,
    );
  });
});
