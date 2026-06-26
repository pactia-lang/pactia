export enum ContextPathKind {
  Workspace = "workspace",
  Package = "package",
}

export interface ContextIrEntry {
  readonly name: string;
  readonly path: string | readonly string[];
  readonly guidance?: readonly string[];
  readonly package?: string;
}

export interface ContextIndexedFile {
  readonly path: string;
  readonly digest: string;
}

export interface ContextIndexEntry {
  readonly name: string;
  readonly scope: string;
  readonly path: string | readonly string[];
  readonly files: readonly ContextIndexedFile[];
  readonly guidance?: readonly string[];
  readonly package?: string;
}

export interface ContextIndexDocument {
  readonly entries: readonly ContextIndexEntry[];
}

export const CONTEXT_FILE_WARN_THRESHOLD = 50;
export const CONTEXT_FILE_ERROR_THRESHOLD = 500;
