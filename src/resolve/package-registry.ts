export enum PackageRepoLayout {
  Root = "root",
  Subdir = "subdir",
}

export interface PackageGitSource {
  readonly url: string;
  readonly layout: PackageRepoLayout;
  readonly subdir?: string;
}

/** Known first-party packages — git tag v{version} convention. */
const PACKAGE_GIT_SOURCES: Readonly<Record<string, PackageGitSource>> = {
  "@pactia/kernel": {
    url: "https://github.com/pactia-lang/kernel.git",
    layout: PackageRepoLayout.Root,
  },
  "@pactia/rust-stack": {
    url: "https://github.com/pactia-lang/pactia-io.git",
    layout: PackageRepoLayout.Subdir,
    subdir: "rust-anb",
  },
  "@pactia/html-css-js": {
    url: "https://github.com/pactia-lang/pactia-io.git",
    layout: PackageRepoLayout.Subdir,
    subdir: "html-css-js",
  },
};

export function gitSourceForCoordinate(coordinate: string): PackageGitSource | undefined {
  return PACKAGE_GIT_SOURCES[coordinate];
}
