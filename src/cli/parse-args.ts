import { PactiaCommand } from "../domain/pactia-command.js";

export interface CliArgs {
  readonly command: PactiaCommand | undefined;
  readonly workspaceRoot: string | undefined;
  readonly outputDir: string | undefined;
  readonly initDirectory: string | undefined;
  readonly initName: string | undefined;
  readonly addCoordinate: string | undefined;
  readonly addRange: string | undefined;
  readonly updateCoordinate: string | undefined;
  readonly whyCoordinate: string | undefined;
  readonly removeCoordinate: string | undefined;
  readonly publishDryRun: boolean;
  readonly bundleContext: boolean;
  readonly json: boolean;
}

export function parseCommand(value: string): PactiaCommand | undefined {
  return (Object.values(PactiaCommand) as string[]).includes(value)
    ? (value as PactiaCommand)
    : undefined;
}

export function parseArgs(argv: string[]): CliArgs {
  const [commandRaw = "", ...optionArgs] = argv;
  let workspaceRoot: string | undefined;
  let outputDir: string | undefined;
  let initDirectory: string | undefined;
  let initName: string | undefined;
  let addCoordinate: string | undefined;
  let addRange: string | undefined;
  let updateCoordinate: string | undefined;
  let whyCoordinate: string | undefined;
  let removeCoordinate: string | undefined;
  let publishDryRun = false;
  let bundleContext = true;
  let json = false;

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
    } else if (arg === "--dry-run") {
      publishDryRun = true;
    } else if (arg === "--no-bundle-context") {
      bundleContext = false;
    } else if (arg === "--json") {
      json = true;
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
  if (commandRaw === PactiaCommand.Update) {
    updateCoordinate = positionals[0];
  }
  if (commandRaw === PactiaCommand.Why) {
    whyCoordinate = positionals[0];
  }
  if (commandRaw === PactiaCommand.Remove || commandRaw === PactiaCommand.Rm) {
    removeCoordinate = positionals[0];
  }

  return {
    command: parseCommand(commandRaw),
    workspaceRoot,
    outputDir,
    initDirectory,
    initName,
    addCoordinate,
    addRange,
    updateCoordinate,
    whyCoordinate,
    removeCoordinate,
    publishDryRun,
    bundleContext,
    json,
  };
}

export function printUsage(): void {
  process.stderr.write(
    "Usage:\n" +
      "  pactia init <dir> [--name <ProductName>]\n" +
      "  pactia add <@scope/name> [range] [-C <workspace-dir>]\n" +
      "  pactia install [-C <workspace-dir>]\n" +
      "  pactia update [<@scope/name>] [-C <workspace-dir>]\n" +
      "  pactia build [-C <workspace-dir>] [-o <output-dir>] [--no-bundle-context]\n" +
      "  pactia why <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia publish --dry-run [-C <package-dir>]\n" +
      "  pactia outdated [-C <workspace-dir>] [--json]\n" +
      "  pactia clean [-C <workspace-dir>] [-o <output-dir>]\n" +
      "  pactia remove <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia rm <@scope/name> [-C <workspace-dir>]\n" +
      "\n" +
      "Global options: --help, -h, --version, -v, --json\n",
  );
}
