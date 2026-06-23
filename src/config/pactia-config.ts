export enum DownloadPrefer {
  Http = "http",
  Git = "git",
}

export interface PactiaHostConfig {
  readonly git: string;
  readonly api: string;
  readonly token?: string;
}

export interface PactiaSourceConfig {
  readonly git: string;
  readonly subdir?: string;
}

export interface PactiaConfig {
  readonly sources: ReadonlyMap<string, PactiaSourceConfig>;
  readonly hosts: ReadonlyMap<string, PactiaHostConfig>;
  readonly prefer: DownloadPrefer;
}
