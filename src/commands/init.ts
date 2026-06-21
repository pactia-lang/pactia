import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runFetch, FetchError } from "./fetch.js";
import {
  parseProductStack,
  ProductStack,
  renderProductPactia,
  stackDependenciesFor,
} from "../templates/product-stack.js";
import { serializeWorkspaceToml } from "../resolve/workspace-toml.js";

export interface InitOptions {
  readonly directory: string;
  readonly name?: string;
  readonly stack?: ProductStack;
}

export interface InitResult {
  readonly workspaceRoot: string;
  readonly productName: string;
  readonly stack: ProductStack;
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
  const stack = options.stack ?? ProductStack.RustStack;
  const slug = workspaceRoot.split("/").pop() ?? "product";
  const productName = toProductName(slug, options.name);

  const toml = serializeWorkspaceToml({
    name: slug,
    version: "0.1.0",
    dependencies: stackDependenciesFor(stack),
  });

  writeFileSync(join(workspaceRoot, "pactia.toml"), toml, "utf8");
  writeFileSync(
    join(workspaceRoot, "product.pactia"),
    renderProductPactia(productName, stack),
    "utf8",
  );

  try {
    runFetch({ workspaceRoot });
  } catch (error) {
    if (error instanceof FetchError) {
      throw new InitError(error.message);
    }
    throw error;
  }

  return { workspaceRoot, productName, stack };
}

export { parseProductStack, ProductStack };
