#!/usr/bin/env node
import { PactiaCommand } from "./domain/pactia-command.js";
import { runAdd } from "./commands/add.js";
import { runBuild, BuildError } from "./commands/build.js";
import { runFetch, FetchError } from "./commands/fetch.js";
import { runInit, InitError, parseProductStack } from "./commands/init.js";
import { runTest } from "./commands/test.js";
import { ResolveError } from "./domain/resolve-error.js";
import { WorkspaceError } from "./workspace/find-workspace.js";
import { TestError, formatTestReport } from "./commands/test.js";

interface CliArgs {
  readonly command: PactiaCommand | undefined;
  readonly workspaceRoot: string | undefined;
  readonly outputDir: string | undefined;
  readonly initDirectory: string | undefined;
  readonly initName: string | undefined;
  readonly initStack: string | undefined;
  readonly addCoordinate: string | undefined;
  readonly addRange: string | undefined;
}

function parseCommand(value: string): PactiaCommand | undefined {
  return (Object.values(PactiaCommand) as string[]).includes(value)
    ? (value as PactiaCommand)
    : undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const [commandRaw = "", ...optionArgs] = argv;
  let workspaceRoot: string | undefined;
  let outputDir: string | undefined;
  let initDirectory: string | undefined;
  let initName: string | undefined;
  let initStack: string | undefined;
  let addCoordinate: string | undefined;
  let addRange: string | undefined;

  const positionals: string[] = [];

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if ((arg === "-C" || arg === "--directory") && optionArgs[i + 1]) {
      workspaceRoot = optionArgs[i + 1];
      i += 1;
    } else if ((arg === "-o" || arg === "--output") && optionArgs[i + 1]) {
      outputDir = optionArgs[i + 1];
      i += 1;
    } else if (arg === "--name" && optionArgs[i + 1]) {
      initName = optionArgs[i + 1];
      i += 1;
    } else if (arg === "--stack" && optionArgs[i + 1]) {
      initStack = optionArgs[i + 1];
      i += 1;
    } else if (arg && !arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  if (commandRaw === PactiaCommand.Init) {
    initDirectory = positionals[0];
  }
  if (commandRaw === PactiaCommand.Add) {
    addCoordinate = positionals[0];
    addRange = positionals[1];
  }

  return {
    command: parseCommand(commandRaw),
    workspaceRoot,
    outputDir,
    initDirectory,
    initName,
    initStack,
    addCoordinate,
    addRange,
  };
}

function printUsage(): void {
  process.stderr.write(
    "Usage:\n" +
      "  pactia init <dir> [--name <ProductName>] [--stack rust-stack|html-css-js]\n" +
      "  pactia add <@scope/name> [range] [-C <workspace-dir>]\n" +
      "  pactia fetch [-C <workspace-dir>]\n" +
      "  pactia build [-C <workspace-dir>] [-o <output-dir>]\n" +
      "  pactia test  [-C <workspace-dir>] [-o <output-dir>]\n",
  );
}

function handleError(error: unknown): void {
  if (
    error instanceof BuildError ||
    error instanceof WorkspaceError ||
    error instanceof ResolveError ||
    error instanceof InitError ||
    error instanceof FetchError ||
    error instanceof TestError
  ) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
    return;
  }
  throw error;
}

function runCommand(args: CliArgs): void {
  switch (args.command) {
    case PactiaCommand.Init: {
      if (!args.initDirectory) {
        printUsage();
        process.exit(1);
        return;
      }
      const result = runInit({
        directory: args.initDirectory,
        name: args.initName,
        stack: parseProductStack(args.initStack),
      });
      process.stdout.write(
        `Initialized '${result.productName}' at ${result.workspaceRoot} (${result.stack})\n`,
      );
      return;
    }
    case PactiaCommand.Add: {
      if (!args.addCoordinate) {
        printUsage();
        process.exit(1);
        return;
      }
      const result = runAdd({
        workspaceRoot: args.workspaceRoot,
        coordinate: args.addCoordinate,
        range: args.addRange,
      });
      if (result.lockWritten) {
        process.stdout.write(`updated pactia.lock\n`);
      }
      if (result.fetched.length > 0) {
        process.stdout.write(`fetched ${result.fetched.join(", ")}\n`);
      }
      process.stdout.write(`added ${result.coordinate} = "${result.range}"\n`);
      return;
    }
    case PactiaCommand.Fetch: {
      const result = runFetch({ workspaceRoot: args.workspaceRoot });
      if (result.lockWritten) {
        process.stdout.write(`updated pactia.lock\n`);
      }
      if (result.fetched.length > 0) {
        process.stdout.write(`fetched ${result.fetched.join(", ")}\n`);
      }
      if (result.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${result.vendoredPackages.join(", ")}\n`);
      }
      process.stdout.write(`Finished fetch at ${result.workspaceRoot}\n`);
      return;
    }
    case PactiaCommand.Build: {
      const options = {
        workspaceRoot: args.workspaceRoot,
        outputDir: args.outputDir,
      };
      const build = runBuild(options);

      if (build.lockWritten) {
        process.stdout.write("updated pactia.lock\n");
      }
      if (build.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${build.vendoredPackages.join(", ")}\n`);
      }
      for (const relPath of build.filesWritten) {
        process.stdout.write(`wrote ${relPath}\n`);
      }
      process.stdout.write(`Finished \`${args.command}\` at ${build.outputDir}\n`);
      return;
    }
    case PactiaCommand.Test: {
      const options = {
        workspaceRoot: args.workspaceRoot,
        outputDir: args.outputDir,
      };
      const result = runTest(options);

      if (result.lockWritten) {
        process.stdout.write("updated pactia.lock\n");
      }
      if (result.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${result.vendoredPackages.join(", ")}\n`);
      }
      for (const relPath of result.filesWritten) {
        process.stdout.write(`wrote ${relPath}\n`);
      }
      for (const line of formatTestReport(result.summary)) {
        process.stdout.write(`${line}\n`);
      }
      process.stdout.write(
        `${result.summary.passed} scenario(s) passed at ${result.outputDir}\n`,
      );
      return;
    }
    default:
      printUsage();
      process.exit(1);
  }
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
    handleError(error);
  }
}

main();
