import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ScenarioCase } from "./test-types.js";

interface ServiceDocument {
  readonly service?: {
    readonly name?: string;
    readonly extensions?: readonly Record<string, unknown>[];
  };
}

function isScenarioExtension(
  entry: Record<string, unknown>,
): entry is Record<string, unknown> & { when: string; then: string; name: string } {
  return (
    typeof entry["when"] === "string" &&
    typeof entry["then"] === "string" &&
    typeof entry["name"] === "string"
  );
}

function isApiExtension(
  entry: Record<string, unknown>,
): entry is Record<string, unknown> & { method: string; path: string } {
  return typeof entry["method"] === "string" && typeof entry["path"] === "string";
}

export interface ServiceIrSlice {
  readonly filePath: string;
  readonly serviceName: string;
  readonly apis: readonly { readonly method: string; readonly path: string; readonly id?: string }[];
  readonly scenarios: readonly ScenarioCase[];
}

function parseServiceFile(filePath: string): ServiceIrSlice {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ServiceDocument;
  const serviceName = parsed.service?.name ?? "unknown";
  const extensions = parsed.service?.extensions ?? [];

  const apis = extensions.filter(isApiExtension).map((entry) => ({
    method: entry["method"],
    path: entry["path"],
    id: typeof entry["id"] === "string" ? entry["id"] : undefined,
  }));

  const scenarios = extensions.filter(isScenarioExtension).map((entry) => ({
    serviceFile: filePath,
    serviceName,
    id: typeof entry["id"] === "string" ? entry["id"] : entry["name"],
    name: entry["name"],
    when: entry["when"],
    then: entry["then"],
  }));

  return { filePath, serviceName, apis, scenarios };
}

function walkServiceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkServiceFiles(path));
    } else if (entry.endsWith(".service.json")) {
      files.push(path);
    }
  }
  return files;
}

/** Collect @test scenarios and API endpoints from compiled service IR. */
export function collectServiceIr(outputDir: string): readonly ServiceIrSlice[] {
  const servicesDir = join(outputDir, "input", "modules");
  return walkServiceFiles(servicesDir).map(parseServiceFile);
}
