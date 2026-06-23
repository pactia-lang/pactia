import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DownloadPrefer } from "./pactia-config.js";
import { loadPactiaConfig, parsePactiaConfig, pactiaConfigPath } from "./load-pactia-config.js";
import { ResolveError, ResolveErrorCode } from "../domain/resolve-error.js";

describe("parsePactiaConfig", () => {
  it("parses sources, hosts, and defaults", () => {
    const config = parsePactiaConfig(`
[source."@pactia/"]
git = "https://github.com/pactia-io"
subdir = "packages"

[hosts."github.com"]
git = "https://github.com"
api = "https://api.github.com"
token = "env:TOKEN"

[defaults]
prefer = "git"
`);
    assert.equal(config.prefer, DownloadPrefer.Git);
    assert.equal(config.sources.get("@pactia/")?.git, "https://github.com/pactia-io");
    assert.equal(config.sources.get("@pactia/")?.subdir, "packages");
    assert.equal(config.hosts.get("github.com")?.api, "https://api.github.com");
    assert.equal(config.hosts.get("github.com")?.token, "env:TOKEN");
  });

  it("skips incomplete host sections without api", () => {
    const config = parsePactiaConfig(`
[hosts."github.com"]
git = "https://github.com"
`);
    assert.equal(config.hosts.has("github.com"), false);
  });
});

describe("loadPactiaConfig", () => {
  it("loads config from a file path", () => {
    const dir = mkdtempSync(join(tmpdir(), "pactia-config-"));
    const path = join(dir, "config.toml");
    writeFileSync(
      path,
      `[source."@pactia/"]\ngit = "https://github.com/pactia-io"\n`,
      "utf8",
    );
    try {
      const config = loadPactiaConfig(path);
      assert.ok(config.sources.has("@pactia/"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when config file is missing", () => {
    assert.throws(
      () => loadPactiaConfig("/nonexistent/pactia-config.toml"),
      (error: unknown) =>
        error instanceof ResolveError && error.code === ResolveErrorCode.ConfigMissing,
    );
  });
});

describe("pactiaConfigPath", () => {
  it("honors PACTIA_CONFIG override", () => {
    const previous = process.env["PACTIA_CONFIG"];
    process.env["PACTIA_CONFIG"] = "/tmp/custom-config.toml";
    try {
      assert.equal(pactiaConfigPath(), "/tmp/custom-config.toml");
    } finally {
      if (previous === undefined) delete process.env["PACTIA_CONFIG"];
      else process.env["PACTIA_CONFIG"] = previous;
    }
  });
});
