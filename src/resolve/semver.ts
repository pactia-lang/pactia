export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export function parseSemver(version: string): SemverParts | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return left.localeCompare(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/** True when `version` satisfies a Cargo-style range (`1.0.0`, `^1.0`, `^1.0.0`). */
export function satisfiesSemver(version: string, range: string): boolean {
  const parts = parseSemver(version);
  if (!parts) return false;

  const trimmed = range.trim();
  const exact = parseSemver(trimmed);
  if (exact) {
    return compareSemver(version, trimmed) === 0;
  }

  const caret = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(trimmed);
  if (caret) {
    const major = Number(caret[1]);
    const minor = caret[2] !== undefined ? Number(caret[2]) : 0;
    const patch = caret[3] !== undefined ? Number(caret[3]) : 0;
    if (parts.major !== major) return false;
    if (caret[2] === undefined) return true;
    if (parts.minor > minor) return true;
    if (parts.minor < minor) return false;
    if (caret[3] === undefined) return true;
    return parts.patch >= patch;
  }

  return false;
}

export function pickBestVersion(available: readonly string[], range: string): string | undefined {
  return [...available]
    .filter((version) => satisfiesSemver(version, range))
    .sort(compareSemver)
    .at(-1);
}
