import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderMinimalProductPactia } from "../templates/init-template.js";
import { serializeWorkspaceToml } from "../resolve/workspace-toml.js";

export interface InitOptions {
  readonly directory: string;
  readonly name?: string;
}

export interface InitResult {
  readonly workspaceRoot: string;
  readonly productName: string;
}

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

function toProductName(directory: string, explicit?: string): string {
  if (explicit) {
    return explicit.replace(/[^A-Za-z0-9_]/g, "");
  }
  const base = directory.split("/").pop() ?? "Product";
  const parts = base.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) return "Product";
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function runInit(options: InitOptions): InitResult {
  const workspaceRoot = resolve(options.directory);
  if (existsSync(workspaceRoot) && existsSync(join(workspaceRoot, "pactia.toml"))) {
    throw new InitError(`Workspace already exists at '${workspaceRoot}'`);
  }

  mkdirSync(workspaceRoot, { recursive: true });
  const slug = workspaceRoot.split("/").pop() ?? "product";
  const productName = toProductName(slug, options.name);

  const toml = serializeWorkspaceToml({
    name: slug,
    version: "0.1.0",
    dependencies: new Map(),
  });

  writeFileSync(join(workspaceRoot, "pactia.toml"), toml, "utf8");
  writeFileSync(
    join(workspaceRoot, "product.pactia"),
    renderMinimalProductPactia(productName),
    "utf8",
  );

  return { workspaceRoot, productName };
}
