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
  readonly offline: boolean;
  readonly cleanCache: boolean;
  readonly noCache: boolean;
  readonly listJson: boolean;
  readonly infoCoordinate: string | undefined;
  readonly cacheSubcommand: string | undefined;
  readonly dryRun: boolean;
  readonly verbose: boolean;
  readonly quiet: boolean;
  readonly outputFormat: string | undefined;
  readonly outputJson: boolean;
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
  let offline = false;
  let cleanCache = false;
  let noCache = false;
  let listJson = false;
  let infoCoordinate: string | undefined;
  let cacheSubcommand: string | undefined;
  let dryRun = false;
  let verbose = false;
  let quiet = false;
  let outputFormat: string | undefined;
  let outputJson = false;

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
      dryRun = true;
    } else if (arg === "--no-bundle-context") {
      bundleContext = false;
    } else if (arg === "--offline") {
      offline = true;
    } else if (arg === "--json") {
      json = true;
      listJson = true;
      outputJson = true;
    } else if (arg === "--cache") {
      cleanCache = true;
    } else if (arg === "--no-cache") {
      noCache = true;
    } else if ((arg === "--format" || arg === "-f") && optionArgs[i + 1]) {
      outputFormat = optionArgs[i + 1];
      i += 1;
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--quiet") {
      quiet = true;
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
  if (commandRaw === PactiaCommand.List || commandRaw === PactiaCommand.Ls) {
    // list takes no positionals, optional --json
  }
  if (commandRaw === PactiaCommand.Info) {
    infoCoordinate = positionals[0];
  }
  if (commandRaw === PactiaCommand.Cache) {
    cacheSubcommand = positionals[0];
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
    offline,
    cleanCache,
    noCache,
    listJson,
    infoCoordinate,
    cacheSubcommand,
    dryRun,
    verbose,
    quiet,
    outputFormat,
    outputJson,
  };
}

export function printUsage(): void {
  process.stderr.write(
    "Usage:\n" +
      "  pactia init <dir> [--name <name>]\n" +
      "  pactia add <@scope/name> [range] [-C <workspace-dir>]\n" +
      "  pactia install [-C <workspace-dir>] [--offline]\n" +
      "  pactia update [<@scope/name>] [-C <workspace-dir>]\n" +
      "  pactia build [-C <workspace-dir>] [-o <output-dir>] [--no-bundle-context] [--offline]\n" +
      "  pactia why <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia publish --dry-run [-C <package-dir>]\n" +
      "  pactia outdated [-C <workspace-dir>] [--json] [--no-cache]\n" +
      "  pactia clean [-C <workspace-dir>] [-o <output-dir>] [--cache]\n" +
      "  pactia remove <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia rm <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia list [-C <workspace-dir>] [--json]\n" +
      "  pactia ls [-C <workspace-dir>] [--json]\n" +
      "  pactia info <@scope/name> [-C <workspace-dir>]\n" +
      "  pactia cache [clean|path] [-C <workspace-dir>]\n" +
      "  pactia vendor [-C <workspace-dir>]\n" +
      "\n" +
      "Global options: --help, -h, --version, -v, --json, --offline\n" +
      "pactia add and pactia update accept --dry-run to preview without modifying files.\n" +
      "Global flags: --verbose, --quiet, --help, -h, --version, -v, --json, --offline\n",
  );
}
