import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const PACTIA_TOML = "pactia.toml";
const PRODUCT_FILE = "product.pactia";

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

function isWorkspaceRoot(dir: string): boolean {
  return (
    existsSync(join(dir, PACTIA_TOML)) && existsSync(join(dir, PRODUCT_FILE))
  );
}

/** Find nearest directory containing pactia.toml and product.pactia. */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);

  while (true) {
    if (isWorkspaceRoot(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new WorkspaceError(
    `No Pactia workspace found from '${startDir}'. Expected ${PACTIA_TOML} and ${PRODUCT_FILE}.`,
  );
}
