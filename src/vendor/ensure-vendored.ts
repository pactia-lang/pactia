import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PactiaLockManifest } from "@pactia/pactiac";
import { packageDirName } from "../domain/package-coordinate.js";
import { packageSearchRoots } from "./cache-paths.js";

export class VendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorError";
  }
}

function isVendoredPackageDir(dir: string): boolean {
  return (
    existsSync(join(dir, "pactia.toml")) ||
    existsSync(join(dir, "index.pactia")) ||
    existsSync(join(dir, "pactia.package.json"))
  );
}

/** Copy locked packages into workspace `.pactia/packages/` when missing. */
export function ensureVendoredPackages(
  workspaceRoot: string,
  lock: PactiaLockManifest,
): readonly string[] {
  if (lock.packages.length === 0) {
    return [];
  }

  const root = resolve(workspaceRoot);
  const vendorDir = join(root, ".pactia", "packages");
  mkdirSync(vendorDir, { recursive: true });

  const copied: string[] = [];
  const searchRoots = packageSearchRoots(root);

  for (const entry of lock.packages) {
    const dirName = packageDirName(entry.name, entry.version);
    const dest = join(vendorDir, dirName);

    if (isVendoredPackageDir(dest)) {
      continue;
    }

    let sourceDir: string | undefined;
    for (const searchRoot of searchRoots) {
      const candidate = join(searchRoot, dirName);
      if (isVendoredPackageDir(candidate)) {
        sourceDir = candidate;
        break;
      }
    }

    if (!sourceDir) {
      throw new VendorError(
        `Locked package '${entry.name}@${entry.version}' is not available under ${vendorDir}. ` +
          `Run pactia fetch or set PACTIA_VENDOR_ROOT.`,
      );
    }

    cpSync(sourceDir, dest, { recursive: true });
    copied.push(entry.name);
  }

  return copied;
}
