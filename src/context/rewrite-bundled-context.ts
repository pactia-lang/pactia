import { bundleContextPath, bundleContextPathValue } from "./bundle-context-path.js";

export function rewriteBundledContextInValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteBundledContextInValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(record)) {
    if (key === "context" && Array.isArray(child)) {
      next[key] = child.map((item) => rewriteContextItem(item));
      continue;
    }
    next[key] = rewriteBundledContextInValue(child);
  }

  return next;
}

function rewriteContextItem(item: unknown): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  const entry = item as Record<string, unknown>;
  const path = entry["path"];
  if (typeof path !== "string" && !Array.isArray(path)) {
    return entry;
  }

  const rewritten: Record<string, unknown> = { ...entry };
  if (typeof path === "string") {
    rewritten["path"] = bundleContextPath(path);
  } else if (Array.isArray(path)) {
    rewritten["path"] = bundleContextPathValue(path);
  }
  delete rewritten["package"];
  return rewritten;
}
