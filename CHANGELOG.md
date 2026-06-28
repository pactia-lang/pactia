# Changelog

All notable package-manager changes are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- **`pactia outdated`** — compares lock versions against available git tags, shows newer versions
- **`pactia clean`** — removes `.pactia/packages/` and build output (`out/` or custom `-o`)
- **`--json` flag** — structured JSON output on `outdated`, `why`, `build` for CI scripting
- **Config auto-copy in install script** — `install-pactia.sh` downloads `config.example.toml` to `~/.pactia/config.toml` on first install
- **Topology package validation** — `publish --dry-run` validates topology package structure, manifest closure, `mixed-exports = true` opt-in, and profile consistency
- **Lock digest for topology packages** — `hashDirectoryMarker` covers `pactia.toml` + `index.pactia` + `export "./…"` closure files
- **`publish -C <subdir>`** — support for monorepo subdirectory package slices

### Changed

- **Lock-is-truth** confirmed — `pactia build` reads lock only; only `add`/`update` write the lockfile
- **Native binary builds** for all 5 platforms (linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64)
- **Context index** — `context.index.json` entries use `name` (aligned with pactiac `context[]` IR)

## [0.2.0] - 2026-06-24

Package manager v0.2 — install workflow, config-driven remotes, context bundle on build.

### Added

- **`pactia install`** — replaces `fetch`; vendors dependencies from `pactia.lock` into `.pactia/packages/`
- **`pactia update [coord]`** — re-resolve and refresh lock entries (optional single coordinate)
- **`pactia why <coord>`** — show why a package is in the lockfile and where it is vendored
- **`pactia publish --dry-run`** — validate package layout and metadata without uploading
- **`~/.pactia/config.toml`** — remotes and host URL templates; no hardcoded registry URLs in the CLI
- **Dual coordinates** — `@pactia/<name>` and `@github.com/<org>/<repo>` (and other configured hosts)
- **HTTP archive download** — GitHub/GitLab tags API, version index cache (`~/.pactia/cache/`), git clone fallback
- **Pre-release semver** — resolve and compare pre-release versions in lock resolution
- Global `--help` / `-h` and `--version` / `-v`
- **`pactia build` context index** — `context.index.json` with per-file digests; bundles context files under `out/input/context/` by default (`--no-bundle-context` to skip copy); rewrites IR and index paths to bundle-relative `context/...` for portable agent handoff
- Windows and macOS install scripts (`install-pactia.ps1`, install notes)

### Changed

- **Lock-is-truth** — `install` and `build` install from `pactia.lock` only; no silent re-resolve
- **`pactia add`** — vendors into `.pactia/packages/` in the same step as lock update
- **`pactia init`** — minimal `product.pactia` with prose and an empty `module core` (compilable after `pactia add`); dropped `--stack` / `ProductStack`
- Split `lock-resolver` and CLI arg parsing into focused modules
- Workspace discovery walks to filesystem root when searching for `pactia.toml`

### Removed

- **`pactia fetch`** command — use `pactia install`

## [0.1.0] - 2026-06-18

Initial `pactia` release — `init`, `add`, `build`, lockfile vendoring, native binaries.

### Added

- `pactia init`, `pactia add`, `pactia build` with `@pactia/pactiac` compile integration
- `pactia.toml` + `pactia.lock` workspace manifests
- Native binaries for Linux, macOS, and Windows (Bun compile, bundles pactiac)

[Unreleased]: https://github.com/pactia-lang/pactia/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pactia-lang/pactia/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pactia-lang/pactia/releases/tag/v0.1.0
