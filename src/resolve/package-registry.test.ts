import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DownloadPrefer, type PactiaConfig } from "../config/pactia-config.js";
import { ResolveError } from "../domain/resolve-error.js";
import { gitSourceForCoordinate, PackageRepoLayout, remoteRefForCoordinate } from "./package-registry.js";

function testConfig(): PactiaConfig {
  return {
    sources: new Map([
      [
        "@pactia/",
        {
          git: "https://github.com/pactia-io",
        },
      ],
    ]),
    hosts: new Map([
      [
        "github.com",
        {
          git: "https://github.com",
          api: "https://api.github.com",
        },
      ],
      [
        "gitlab.com",
        {
          git: "https://gitlab.com",
          api: "https://gitlab.com/api/v4",
        },
      ],
    ]),
    prefer: DownloadPrefer.Http,
  };
}

describe("gitSourceForCoordinate", () => {
  it("resolves @pactia/ prefix sources", () => {
    const source = gitSourceForCoordinate("@pactia/kernel", testConfig());
    assert.equal(source?.url, "https://github.com/pactia-io/kernel.git");
    assert.equal(source?.layout, PackageRepoLayout.Root);
  });

  it("resolves Go-style GitHub coordinates", () => {
    const source = gitSourceForCoordinate("@github.com/acme/fleet-rules", testConfig());
    assert.deepEqual(source, {
      url: "https://github.com/acme/fleet-rules.git",
      layout: PackageRepoLayout.Root,
    });
  });

  it("resolves Go-style GitLab coordinates", () => {
    const source = gitSourceForCoordinate("@gitlab.com/acme/fleet-rules", testConfig());
    assert.deepEqual(source, {
      url: "https://gitlab.com/acme/fleet-rules.git",
      layout: PackageRepoLayout.Root,
    });
  });

  it("errors when host is missing from config", () => {
    assert.throws(
      () => gitSourceForCoordinate("@git.example.com/acme/fleet-rules", testConfig()),
      (error: unknown) =>
        error instanceof ResolveError &&
        error.message.includes('[hosts."git.example.com"]'),
    );
  });
});

describe("remoteRefForCoordinate", () => {
  it("resolves scoped package remotes from source git base", () => {
    const remote = remoteRefForCoordinate("@pactia/kernel", testConfig());
    assert.equal(remote?.host, "github.com");
    assert.equal(remote?.owner, "pactia-io");
    assert.equal(remote?.repo, "kernel");
  });

  it("resolves Go-style remotes", () => {
    const remote = remoteRefForCoordinate("@github.com/acme/fleet-rules", testConfig());
    assert.deepEqual(remote, {
      host: "github.com",
      owner: "acme",
      repo: "fleet-rules",
    });
  });
});
