#!/usr/bin/env node
import { PactiaCommand } from "./domain/pactia-command.js";
import { runBuild, BuildError } from "./commands/build.js";
import { runTest } from "./commands/test.js";
import { WorkspaceError } from "./workspace/find-workspace.js";

interface CliArgs {
  readonly command: PactiaCommand | undefined;
  readonly workspaceRoot: string | undefined;
  readonly outputDir: string | undefined;
}

function parseCommand(value: string): PactiaCommand | undefined {
  if (value === PactiaCommand.Build) return PactiaCommand.Build;
  if (value === PactiaCommand.Test) return PactiaCommand.Test;
  return undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const [commandRaw = "", ...optionArgs] = argv;
  let workspaceRoot: string | undefined;
  let outputDir: string | undefined;

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if ((arg === "-C" || arg === "--directory") && optionArgs[i + 1]) {
      workspaceRoot = optionArgs[i + 1];
      i += 1;
    } else if ((arg === "-o" || arg === "--output") && optionArgs[i + 1]) {
      outputDir = optionArgs[i + 1];
      i += 1;
    }
  }

  return { command: parseCommand(commandRaw), workspaceRoot, outputDir };
}

function printUsage(): void {
  process.stderr.write(
    "Usage:\n" +
      "  pactia build [-C <workspace-dir>] [-o <output-dir>]\n" +
      "  pactia test  [-C <workspace-dir>] [-o <output-dir>]\n",
  );
}

function runCommand(args: CliArgs): void {
  const options = {
    workspaceRoot: args.workspaceRoot,
    outputDir: args.outputDir,
  };

  const build =
    args.command === PactiaCommand.Test ? runTest(options) : runBuild(options);

  if (build.vendoredPackages.length > 0) {
    process.stdout.write(`vendored ${build.vendoredPackages.join(", ")}\n`);
  }
  for (const relPath of build.filesWritten) {
    process.stdout.write(`wrote ${relPath}\n`);
  }
  process.stdout.write(`Finished \`${args.command}\` at ${build.outputDir}\n`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command) {
    printUsage();
    process.exit(1);
    return;
  }

  try {
    runCommand(args);
  } catch (error) {
    if (error instanceof BuildError || error instanceof WorkspaceError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
      return;
    }
    throw error;
  }
}

main();
