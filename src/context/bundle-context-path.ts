export const CONTEXT_BUNDLE_DIR = "context";

export function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Map an authored workspace or package-relative path to a bundle path under input/context/. */
export function bundleContextPath(authoredPath: string): string {
  const normalized = authoredPath.replace(/\\/g, "/");
  const trailingSlash = normalized.endsWith("/") ? "/" : "";
  const core = trailingSlash ? normalized.slice(0, -1) : normalized;
  const relativePath = normalizeRelativePath(core);
  return `${CONTEXT_BUNDLE_DIR}/${relativePath}${trailingSlash}`;
}

export function bundleContextPathValue(path: string | readonly string[]): string | string[] {
  if (typeof path === "string") {
    return bundleContextPath(path);
  }
  return path.map((entry) => bundleContextPath(entry));
}
