export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
}

const SEMVER_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseSemver(version: string): SemverParts | undefined {
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4],
  };
}

function comparePrerelease(left?: string, right?: string): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      const delta = Number(leftPart) - Number(rightPart);
      if (delta !== 0) {
        return delta;
      }
      continue;
    }
    if (leftNumeric) {
      return -1;
    }
    if (rightNumeric) {
      return 1;
    }
    const delta = leftPart.localeCompare(rightPart);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) {
    return left.localeCompare(right);
  }
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function rangeHasPrerelease(range: string): boolean {
  return parseSemver(range.trim())?.prerelease !== undefined;
}

/** True when `version` satisfies a Cargo-style range (`1.0.0`, `^1.0`, `^1.0.0`). */
export function satisfiesSemver(version: string, range: string): boolean {
  const parts = parseSemver(version);
  if (!parts) {
    return false;
  }

  const trimmed = range.trim();
  const exact = parseSemver(trimmed);
  if (exact) {
    return compareSemver(version, trimmed) === 0;
  }

  const caret = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/.exec(trimmed);
  if (caret) {
    const major = Number(caret[1]);
    const minor = caret[2] !== undefined ? Number(caret[2]) : 0;
    const patch = caret[3] !== undefined ? Number(caret[3]) : 0;
    const rangePrerelease = caret[4];

    if (parts.major !== major) {
      return false;
    }
    if (parts.prerelease && !rangePrerelease && !rangeHasPrerelease(trimmed)) {
      return false;
    }
    if (caret[2] === undefined) {
      return true;
    }
    if (parts.minor > minor) {
      return true;
    }
    if (parts.minor < minor) {
      return false;
    }
    if (caret[3] === undefined) {
      return true;
    }
    if (parts.patch > patch) {
      return true;
    }
    if (parts.patch < patch) {
      return false;
    }
    if (rangePrerelease) {
      return parts.prerelease === rangePrerelease;
    }
    return !parts.prerelease;
  }

  return false;
}

export function pickBestVersion(available: readonly string[], range: string): string | undefined {
  return [...available]
    .filter((version) => satisfiesSemver(version, range))
    .sort(compareSemver)
    .at(-1);
}
