import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const PACTIA_TOML = "pactia.toml";
const PACTIA_LOCK = "pactia.lock";
const PRODUCT_FILE = "product.pactia";

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

function isWorkspaceRoot(dir: string): boolean {
  return (
    existsSync(join(dir, PACTIA_TOML)) &&
    existsSync(join(dir, PACTIA_LOCK)) &&
    existsSync(join(dir, PRODUCT_FILE))
  );
}

/** Find nearest directory containing pactia.toml, pactia.lock, and product.pactia. */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  const root = dirname(dir);

  while (true) {
    if (isWorkspaceRoot(dir)) {
      return dir;
    }
    if (dir === root) {
      break;
    }
    dir = dirname(dir);
  }

  throw new WorkspaceError(
    `No Pactia workspace found from '${startDir}'. Expected ${PACTIA_TOML}, ${PACTIA_LOCK}, and ${PRODUCT_FILE}.`,
  );
}
