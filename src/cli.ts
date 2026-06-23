#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PactiaCommand } from "./domain/pactia-command.js";
import { runAdd } from "./commands/add.js";
import { runBuild, BuildError } from "./commands/build.js";
import { runInstall, InstallError } from "./commands/install.js";
import { runInit, InitError } from "./commands/init.js";
import { ResolveError } from "./domain/resolve-error.js";
import { WorkspaceError } from "./workspace/find-workspace.js";

interface CliArgs {
  readonly command: PactiaCommand | undefined;
  readonly workspaceRoot: string | undefined;
  readonly outputDir: string | undefined;
  readonly initDirectory: string | undefined;
  readonly initName: string | undefined;
  readonly addCoordinate: string | undefined;
  readonly addRange: string | undefined;
}

function cliVersion(): string {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };
  return manifest.version ?? "0.0.0";
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
    addCoordinate,
    addRange,
  };
}

function printUsage(): void {
  process.stderr.write(
    "Usage:\n" +
      "  pactia init <dir> [--name <ProductName>]\n" +
      "  pactia add <@scope/name> [range] [-C <workspace-dir>]\n" +
      "  pactia install [-C <workspace-dir>]\n" +
      "  pactia build [-C <workspace-dir>] [-o <output-dir>]\n" +
      "\n" +
      "Global options: --help, -h, --version, -v\n",
  );
}

function handleError(error: unknown): void {
  if (
    error instanceof BuildError ||
    error instanceof WorkspaceError ||
    error instanceof ResolveError ||
    error instanceof InitError ||
    error instanceof InstallError
  ) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
    return;
  }
  throw error;
}

async function runCommand(args: CliArgs): Promise<void> {
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
      });
      process.stdout.write(
        `Initialized '${result.productName}' at ${result.workspaceRoot}\n`,
      );
      return;
    }
    case PactiaCommand.Add: {
      if (!args.addCoordinate) {
        printUsage();
        process.exit(1);
        return;
      }
      const result = await runAdd({
        workspaceRoot: args.workspaceRoot,
        coordinate: args.addCoordinate,
        range: args.addRange,
      });
      if (result.lockWritten) {
        process.stdout.write(`updated pactia.lock\n`);
      }
      if (result.installed.length > 0) {
        process.stdout.write(`installed ${result.installed.join(", ")}\n`);
      }
      if (result.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${result.vendoredPackages.join(", ")}\n`);
      }
      process.stdout.write(`added ${result.coordinate} = "${result.range}"\n`);
      return;
    }
    case PactiaCommand.Install: {
      const result = await runInstall({ workspaceRoot: args.workspaceRoot });
      if (result.lockWritten) {
        process.stdout.write(`updated pactia.lock\n`);
      }
      if (result.installed.length > 0) {
        process.stdout.write(`installed ${result.installed.join(", ")}\n`);
      }
      if (result.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${result.vendoredPackages.join(", ")}\n`);
      }
      process.stdout.write(`Finished install at ${result.workspaceRoot}\n`);
      return;
    }
    case PactiaCommand.Build: {
      const options = {
        workspaceRoot: args.workspaceRoot,
        outputDir: args.outputDir,
      };
      const build = await runBuild(options);

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
    default:
      printUsage();
      process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(argv.length === 0 ? 1 : 0);
    return;
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`pactia ${cliVersion()}\n`);
    process.exit(0);
    return;
  }

  const args = parseArgs(argv);
  if (!args.command) {
    printUsage();
    process.exit(1);
    return;
  }

  try {
    await runCommand(args);
  } catch (error) {
    handleError(error);
  }
}

main().catch((error) => {
  handleError(error);
});
