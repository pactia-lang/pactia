# pactia

Package manager for Pactia — like **Cargo** for Rust. Resolves dependencies, vendors packages, runs builds and tests. Invokes [pactiac](https://github.com/pactia-lang/pactiac) (the compiler) under the hood.

## Commands

```bash
pactia build [-C <workspace-dir>] [-o <output-dir>]   # default output: out/
pactia test  [-C <workspace-dir>]                     # compile workspace (acceptance harness TBD)
```

Planned: `init`, `add`, `fetch`, `publish`.

## Workspace layout (app / binary crate)

```
my-product/
  pactia.toml           # [package] + [dependencies] — like Cargo.toml
  pactia.lock           # pinned deps — like Cargo.lock
  product.pactia        # main source
  fragments/…           # attached modules
  .pactia/packages/     # vendored deps (created by pactia build)
  out/                  # compile output (default)
```

## Manifest

```toml
[package]
name = "marketplace"
version = "0.1.0"

[dependencies]
"@pactia/kernel" = "^1.0"
"@pactia/rust-stack" = "^1.0"
```

Stack binding is in source (`#rust-stack` in `product.pactia`), not in TOML.

## Library packages (crates.io equivalent)

```
@pactia/rust-stack/
  pactia.toml           # [package] name, version, kind
  index.pactia          # export defs — like lib.rs
```

No generated JSON manifest. Publish ships `pactia.toml + index.pactia`.

## Development

Requires a sibling [pactiac](https://github.com/pactia-lang/pactiac) checkout (`../pactiac`) — same layout as CI.

```bash
cd pactiac && npm install && npm run build
cd ../pactia && npm install && npm run build
npm run hooks:install   # optional — pre-commit and pre-push run npm test
npm test
```

### Project layout

```
pactia/
  src/
    cli.ts
    commands/         build, test
    vendor/           lock → .pactia/packages/
    workspace/        find pactia.toml + product.pactia
  scripts/
    install-hooks.sh
  .githooks/          pre-commit (test), pre-push (test)
  .github/workflows/  CI on Node 20 and 22
```

## License

MIT — see [LICENSE](LICENSE).
