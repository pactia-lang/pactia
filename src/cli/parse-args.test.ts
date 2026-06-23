import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PactiaCommand } from "../domain/pactia-command.js";
import { parseArgs, parseCommand } from "./parse-args.js";

describe("parseCommand", () => {
  it("parses known commands", () => {
    assert.equal(parseCommand("install"), PactiaCommand.Install);
    assert.equal(parseCommand("why"), PactiaCommand.Why);
    assert.equal(parseCommand("nope"), undefined);
  });
});

describe("parseArgs", () => {
  it("parses workspace and output flags", () => {
    const args = parseArgs(["build", "-C", "/tmp/ws", "-o", "/tmp/out"]);
    assert.equal(args.command, PactiaCommand.Build);
    assert.equal(args.workspaceRoot, "/tmp/ws");
    assert.equal(args.outputDir, "/tmp/out");
  });

  it("parses add coordinates and range", () => {
    const args = parseArgs(["add", "@pactia/kernel", "^1.0", "-C", "/tmp/ws"]);
    assert.equal(args.command, PactiaCommand.Add);
    assert.equal(args.addCoordinate, "@pactia/kernel");
    assert.equal(args.addRange, "^1.0");
    assert.equal(args.workspaceRoot, "/tmp/ws");
  });

  it("parses publish dry-run", () => {
    const args = parseArgs(["publish", "--dry-run", "-C", "/pkg"]);
    assert.equal(args.command, PactiaCommand.Publish);
    assert.equal(args.publishDryRun, true);
    assert.equal(args.workspaceRoot, "/pkg");
  });

  it("parses why coordinate", () => {
    const args = parseArgs(["why", "kernel"]);
    assert.equal(args.command, PactiaCommand.Why);
    assert.equal(args.whyCoordinate, "kernel");
  });
});
