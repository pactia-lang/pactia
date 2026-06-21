import type { PactiaLockManifest } from "@pactia/pactiac";

export function serializePactiaLock(lock: PactiaLockManifest): string {
  const lines = ["lockVersion = 1", ""];
  const packages = [...lock.packages].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of packages) {
    lines.push("[[package]]");
    lines.push(`name = "${entry.name}"`);
    lines.push(`version = "${entry.version}"`);
    lines.push(`digest = "${entry.digest}"`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
