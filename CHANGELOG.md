# Changelog

All notable package-manager changes are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
- **`pactia build`** — resolve lock, vendor packages, invoke `@pactia/pactiac` compile, write `out/`
- Rust crate package model — `pactia.toml` + `index.pactia`; no `pactia.package.json`
- CI (Node 20/22), git hooks, PR and issue templates
- Broad unit and integration test coverage (config, resolver, install, vendor, CLI, commands)

### Changed

- **Lock-is-truth** — `install` and `build` install from `pactia.lock` only; no silent re-resolve
- **`pactia add`** — vendors into `.pactia/packages/` in the same step as lock update
- **`pactia init`** — minimal prose-only `product.pactia`; dropped `--stack` / `ProductStack`
- Split `lock-resolver` and CLI arg parsing into focused modules (`lock-types`, `lock-support`, `install-locked-packages`, `resolve-workspace-lock`, `cli/parse-args`)
- Workspace discovery walks to filesystem root when searching for `pactia.toml`

### Removed

- **`pactia fetch`** command — use `pactia install`
