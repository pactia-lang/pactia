export interface WorkspaceToml {
  readonly name: string;
  readonly version: string;
  readonly dependencies: ReadonlyMap<string, string>;
}

type TomlSection = "none" | "package" | "dependencies";

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function parseWorkspaceToml(source: string): WorkspaceToml {
  let name = "unnamed";
  let version = "0.1.0";
  const dependencies = new Map<string, string>();
  let section: TomlSection = "none";

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    if (line === "[package]") {
      section = "package";
      continue;
    }
    if (line === "[dependencies]") {
      section = "dependencies";
      continue;
    }
    if (line.startsWith("[")) {
      section = "none";
      continue;
    }

    const kv = /^([^=]+)=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const key = unquote(kv[1]!.trim());
    const value = unquote(kv[2]!.trim());

    if (section === "package") {
      if (key === "name") name = value;
      if (key === "version") version = value;
    } else if (section === "dependencies") {
      dependencies.set(key, value);
    }
  }

  return { name, version, dependencies };
}

export function serializeWorkspaceToml(manifest: WorkspaceToml): string {
  const lines = [
    "[package]",
    `name = "${manifest.name}"`,
    `version = "${manifest.version}"`,
    "",
    "[dependencies]",
  ];

  const deps = [...manifest.dependencies.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [coordinate, range] of deps) {
    lines.push(`"${coordinate}" = "${range}"`);
  }

  return `${lines.join("\n")}\n`;
}

export function upsertDependency(
  source: string,
  coordinate: string,
  range: string,
): string {
  const manifest = parseWorkspaceToml(source);
  const next = new Map(manifest.dependencies);
  next.set(coordinate, range);
  return serializeWorkspaceToml({ ...manifest, dependencies: next });
}
