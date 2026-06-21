import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeCompileOutput(
  files: ReadonlyMap<string, string>,
  outputDir: string,
): readonly string[] {
  const written: string[] = [];
  for (const [relPath, content] of files) {
    const fullPath = join(outputDir, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
    written.push(relPath);
  }
  return written;
}
