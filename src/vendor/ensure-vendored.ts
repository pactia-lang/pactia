import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PactiaLockManifest } from "@pactia/pactiac";
import { packageDirName } from "./package-dir-name.js";

const VENDOR_SUBDIR = ".pactia/packages";

function isVendoredPackageDir(dir: string): boolean {
  return (
    existsSync(join(dir, "pactia.toml")) ||
    existsSync(join(dir, "index.pactia")) ||
    existsSync(join(dir, "pactia.package.json"))
  );
}

function vendorSearchRoots(workspaceRoot: string): readonly string[] {
  const roots: string[] = [];
  const envRoot = process.env["PACTIA_VENDOR_ROOT"];
  if (envRoot) {
    roots.push(resolve(envRoot));
  }

  const monorepoCandidates = [
    join(workspaceRoot, "..", "..", "pactiac", "test", "fixtures", "packages"),
    join(workspaceRoot, "..", "pactiac", "test", "fixtures", "packages"),
  ];
  for (const candidate of monorepoCandidates) {
    if (existsSync(candidate)) {
      roots.push(resolve(candidate));
    }
  }

  return roots;
}

export class VendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorError";
  }
}

/** Copy locked packages into workspace `.pactia/packages/` when missing (Cargo vendor-style). */
export function ensureVendoredPackages(
  workspaceRoot: string,
  lock: PactiaLockManifest,
): readonly string[] {
  const root = resolve(workspaceRoot);
  const vendorDir = join(root, VENDOR_SUBDIR);
  mkdirSync(vendorDir, { recursive: true });

  const copied: string[] = [];
  const searchRoots = vendorSearchRoots(root);

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
        `Locked package '${entry.name}@${entry.version}' is not vendored under ${vendorDir}. ` +
          `Set PACTIA_VENDOR_ROOT to a directory containing ${dirName}, or run pactia fetch (planned).`,
      );
    }

    cpSync(sourceDir, dest, { recursive: true });
    copied.push(entry.name);
  }

  return copied;
}
