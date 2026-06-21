# Changelog

All notable package-manager changes are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- **`pactia build`** — resolve lock, vendor packages, invoke `@pactia/pactiac` compile, write `out/`
- **`pactia test`** — build workspace, then validate `@test` scenarios from compiled service IR (when/then parsing, API cross-check, required HTTP status)
- Rust crate package model — `pactia.toml` + `index.pactia`; no `pactia.package.json`
- CI (Node 20/22), git hooks, PR and issue templates
