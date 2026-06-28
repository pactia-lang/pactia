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
import { runOutdated, OutdatedError } from "./commands/outdated.js";
import { runClean, CleanError } from "./commands/clean.js";
import { runRemove, RemoveError } from "./commands/remove.js";
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
    error instanceof PublishError ||
    error instanceof OutdatedError ||
    error instanceof CleanError ||
    error instanceof RemoveError
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

      if (args.json) {
        process.stdout.write(
          `${JSON.stringify({ outputDir: build.outputDir, filesWritten: build.filesWritten, vendoredPackages: build.vendoredPackages })}\n`,
        );
      } else {
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
      }
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
      if (args.json) {
        process.stdout.write(
          `${JSON.stringify({ coordinate: result.coordinate, output: result.output })}\n`,
        );
      } else {
        process.stdout.write(`${result.output}\n`);
      }
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
    case PactiaCommand.Outdated: {
      const result = await runOutdated({
        workspaceRoot: args.workspaceRoot,
        json: args.json,
      });
      if (args.json) {
        process.stdout.write(`${JSON.stringify(result.entries)}\n`);
      } else {
        if (result.entries.length === 0) {
          process.stdout.write("All dependencies are up to date.\n");
        } else {
          for (const entry of result.entries) {
            if (entry.latest) {
              process.stdout.write(`${entry.coordinate} ${entry.current} → ${entry.latest}\n`);
            } else {
              process.stdout.write(`${entry.coordinate} ${entry.current} (could not check)\n`);
            }
          }
        }
      }
      return;
    }
    case PactiaCommand.Clean: {
      const result = runClean({
        workspaceRoot: args.workspaceRoot,
        outputDir: args.outputDir,
      });
      if (result.removed.length > 0) {
        for (const path of result.removed) {
          process.stdout.write(`removed ${path}\n`);
        }
      } else {
        process.stdout.write("Nothing to clean.\n");
      }
      return;
    }
    case PactiaCommand.Remove:
    case PactiaCommand.Rm: {
      if (!args.removeCoordinate) {
        printUsage();
        process.exit(1);
        return;
      }
      const result = runRemove({
        workspaceRoot: args.workspaceRoot,
        coordinate: args.removeCoordinate,
      });
      if (result.removed) {
        process.stdout.write(`removed ${result.coordinate} from pactia.toml\n`);
      } else {
        process.stdout.write(`dependency '${result.coordinate}' not found in pactia.toml\n`);
      }
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
