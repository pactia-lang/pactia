#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, printUsage } from "./cli/parse-args.js";
import { PactiaCommand } from "./domain/pactia-command.js";
import { runAdd } from "./commands/add.js";
import { runBuild, BuildError } from "./commands/build.js";
import { runInstall, InstallError } from "./commands/install.js";
import { runInit, InitError } from "./commands/init.js";
import { runPublish, PublishError } from "./commands/publish.js";
import { runUpdate, UpdateError } from "./commands/update.js";
import { runWhy, WhyError } from "./commands/why.js";
import { ResolveError } from "./domain/resolve-error.js";
import { WorkspaceError } from "./workspace/find-workspace.js";

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

function handleError(error: unknown): void {
  if (
    error instanceof BuildError ||
    error instanceof WorkspaceError ||
    error instanceof ResolveError ||
    error instanceof InitError ||
    error instanceof InstallError ||
    error instanceof UpdateError ||
    error instanceof WhyError ||
    error instanceof PublishError
  ) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
    return;
  }
  throw error;
}

async function runCommand(args: ReturnType<typeof parseArgs>): Promise<void> {
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
      if (result.installed.length > 0) {
        process.stdout.write(`installed ${result.installed.join(", ")}\n`);
      }
      if (result.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${result.vendoredPackages.join(", ")}\n`);
      }
      process.stdout.write(`Finished install at ${result.workspaceRoot}\n`);
      return;
    }
    case PactiaCommand.Update: {
      const result = await runUpdate({
        workspaceRoot: args.workspaceRoot,
        coordinate: args.updateCoordinate,
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
      if (result.coordinate) {
        process.stdout.write(`updated ${result.coordinate}\n`);
      } else {
        process.stdout.write(`updated all dependencies\n`);
      }
      process.stdout.write(`Finished update at ${result.workspaceRoot}\n`);
      return;
    }
    case PactiaCommand.Build: {
      const options = {
        workspaceRoot: args.workspaceRoot,
        outputDir: args.outputDir,
        bundleContext: args.bundleContext,
      };
      const build = await runBuild(options);

      if (build.vendoredPackages.length > 0) {
        process.stdout.write(`vendored ${build.vendoredPackages.join(", ")}\n`);
      }
      for (const warning of build.contextWarnings) {
        process.stderr.write(`warning: ${warning}\n`);
      }
      for (const relPath of build.filesWritten) {
        process.stdout.write(`wrote ${relPath}\n`);
      }
      process.stdout.write(`Finished \`${args.command}\` at ${build.outputDir}\n`);
      return;
    }
    case PactiaCommand.Why: {
      if (!args.whyCoordinate) {
        printUsage();
        process.exit(1);
        return;
      }
      const result = await runWhy({
        workspaceRoot: args.workspaceRoot,
        coordinate: args.whyCoordinate,
      });
      process.stdout.write(`${result.output}\n`);
      return;
    }
    case PactiaCommand.Publish: {
      const result = runPublish({
        packageRoot: args.workspaceRoot,
        dryRun: args.publishDryRun,
      });
      process.stdout.write(
        `ok: ${result.name}@${result.version} at ${result.packageRoot}\n`,
      );
      process.stdout.write(
        `tag with: git tag v${result.version} && git push origin v${result.version}\n`,
      );
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
