import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dump as yamlDump } from "js-yaml";

export enum OutputFormat {
  Json = "json",
  Yaml = "yaml",
}

export function writeCompileOutput(
  files: ReadonlyMap<string, string>,
  outputDir: string,
  format: OutputFormat = OutputFormat.Yaml,
): readonly string[] {
  const ext = format === OutputFormat.Yaml ? ".yaml" : ".json";
  const written: string[] = [];
  for (const [relPath, content] of files) {
    const outPath = relPath.replace(/\.json$/, ext);
    const fullPath = join(outputDir, outPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    const serialized =
      format === OutputFormat.Yaml
        ? (yamlDump(JSON.parse(content) as unknown, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: false,
          }) as string)
        : content;
    writeFileSync(fullPath, serialized, "utf8");
    written.push(outPath);
  }
  return written;
}
