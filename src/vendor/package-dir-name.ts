/** Vendored package directory name: `@pactia/foo@1.0.0` → `@pactia--foo@1.0.0`. */
export function packageDirName(coordinate: string, version: string): string {
  return `${coordinate.replace(/\//g, "--")}@${version}`;
}
