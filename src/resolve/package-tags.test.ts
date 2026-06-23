import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it, mock } from "node:test";
import { DownloadPrefer } from "../config/pactia-config.js";
import { listRemoteVersions } from "./package-tags.js";
import { versionIndexCachePath } from "../vendor/cache-paths.js";

function testConfig() {
  return {
    sources: new Map([
      ["@pactia/", { git: "https://github.com/pactia-io" }],
    ]),
    hosts: new Map([
      [
        "github.com",
        {
          git: "https://github.com",
          api: "https://api.github.com",
        },
      ],
    ]),
    prefer: DownloadPrefer.Http,
  };
}

describe("listRemoteVersions", () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), "pactia-tag-cache-"));
  const previousCache = process.env["PACTIA_VERSION_CACHE_DIR"];
  process.env["PACTIA_VERSION_CACHE_DIR"] = cacheRoot;

  after(() => {
    if (previousCache === undefined) delete process.env["PACTIA_VERSION_CACHE_DIR"];
    else process.env["PACTIA_VERSION_CACHE_DIR"] = previousCache;
    rmSync(cacheRoot, { recursive: true, force: true });
    mock.restoreAll();
  });

  it("fetches GitHub tags and caches results", async () => {
    const coordinate = "@pactia/kernel";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      Response.json([{ name: "v1.0.0" }, { name: "v1.1.0" }, { name: "not-semver" }]),
    );

    const versions = await listRemoteVersions(coordinate, testConfig());
    assert.deepEqual(versions, ["1.0.0", "1.1.0"]);
    assert.equal(fetchMock.mock.callCount(), 1);

    const cached = await listRemoteVersions(coordinate, testConfig());
    assert.deepEqual(cached, versions);
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.ok(existsSync(versionIndexCachePath(coordinate)));
  });

  it("returns empty list when coordinate has no remote ref", async () => {
    const versions = await listRemoteVersions("@unknown/pkg", testConfig());
    assert.deepEqual(versions, []);
  });
});
