# pactia

Package manager for Pactia workspaces. Resolves dependencies, vendors packages, and runs builds. Invokes [pactiac](https://github.com/pactia-lang/pactiac) (the compiler) under the hood.

## Commands

```bash
pactia init <dir> [--name <ProductName>]
pactia add <@scope/name> [range] [-C <workspace-dir>]
pactia install [-C <workspace-dir>]
pactia update [<@scope/name>] [-C <workspace-dir>]
pactia build [-C <workspace-dir>] [-o <output-dir>]
pactia why <@scope/name> [-C <workspace-dir>]
pactia publish --dry-run [-C <package-dir>]
```

`pactia add` and `pactia update` resolve semver ranges and write `pactia.lock`. `pactia install` and `pactia build` use the lock only (pinned versions, digest verify). `pactia why` explains a locked dependency chain. `pactia publish --dry-run` checks a package tree before you tag. Dependencies download into `~/.pactia/packages/` and copy into `.pactia/packages/`. Configure remotes in `~/.pactia/config.toml` (see `config/config.example.toml`). Set `PACTIA_VENDOR_ROOT` for a local package index during development.

Release packages with `git tag v{version} && git push` after a successful dry-run.

## Package storage

After `pactia install` (or `pactia build`, which install-then-compiles), packages live in two places:

- **`~/.pactia/packages/`** — global cache where install downloads or copies packages (git clone, or from `PACTIA_VENDOR_ROOT`)
- **`<workspace>/.pactia/packages/`** — workspace vendor: copies of locked packages used by pactiac when compiling this project

Directory names encode coordinate and version: `@pactia/kernel@1.0.0` → `@pactia--kernel@1.0.0/` (scope `/` becomes `--`).

Example global cache entry:

```
~/.pactia/packages/@pactia--kernel@1.0.0/
  pactia.toml
  index.pactia
  .digest
```

When vendoring, pactia looks for packages in this order: workspace `.pactia/packages/`, then `~/.pactia/packages/`, then `PACTIA_VENDOR_ROOT` if set.

## Workspace layout

```
my-product/
  pactia.toml           # [package] + [dependencies]
  pactia.lock           # pinned dependency versions
  product.pactia        # package imports + attach (fragments do not import @pactia/*)
  fragments/…           # attached modules
  .pactia/packages/     # vendored deps (copied from ~/.pactia/packages/ on install/build)
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

## Imports and attach

Multi-file workspaces use **import + attach** in `product.pactia`:

- **Package imports** (`import { @api, #database, … } from @pactia/kernel`) — declare tags and macros once at product scope. `pactia.toml` / `pactia.lock` pin versions; vendored packages land in `.pactia/packages/`.
- **Fragment imports** (`import { CatalogAdminService } from ./fragments/…`) — register `export module` / `export service` / `export model` symbols for attach only.

Fragment files do **not** repeat `import … from @pactia/…`. On `pactia build`, pactiac merges attach bodies into one program; product-level package imports apply to all inlined fragments.

```pactia
// product.pactia
import { @api, @auth, #database } from @pactia/kernel;
import { CatalogAdminService } from ./fragments/catalog-admin.service.pactia;

product Marketplace {
  module(catalog) {
    service(CatalogAdminService) { model(catalog_model) }
  }
}
```

```pactia
// fragments/catalog-admin.service.pactia — no @pactia/* import
export service CatalogAdminService {
  #database
  @auth { roles: [CatalogOperator] }
  @api create_product { method: POST, path: "/api/v1/products", }
}
```

Canonical example: [marketplace](https://github.com/pactia-lang/examples/tree/main/marketplace). Full rules: [spec — Package imports vs fragment imports](https://github.com/pactia-lang/spec/blob/main/docs/language-spec.md#package-imports-vs-fragment-imports).

## Library packages

```
@pactia/html-css-js/
  pactia.toml           # [package] name, version
  index.pactia          # export defs (macros, tags, modifiers)
```

No generated JSON manifest. Publish ships `pactia.toml + index.pactia`.

## Native binary (no Node required)

Build a standalone `pactia` executable with [Bun](https://bun.sh) compile. The binary **bundles pactiac** at build time (sibling `../pactiac` checkout required, same as CI).

```bash
cd ../pactiac && npm ci && npm run build
cd ../pactia && npm ci
bun run build:bin:linux-x64          # one platform
bun run build:bin                    # all platforms (release)
bun run test:bin                     # build + smoke (website + init/build)
./dist/pactia-linux-x64 build -C ./my-product
```

Release assets (`pactia-linux-x64`, `pactia-darwin-arm64`, …) are published on [GitHub Releases](https://github.com/pactia-lang/pactia/releases) when you push a version tag (`v*`).

### Linux and macOS

The install script picks the right asset (Intel vs Apple Silicon on Mac):

```bash
curl -fsSL https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.sh | bash
./scripts/install-pactia.sh v0.1.0
```

Installs to `~/.local/bin/pactia`. Ensure that directory is on your `PATH` (e.g. in `~/.zshrc` on macOS).

### Windows

PowerShell (installs to `%USERPROFILE%\.local\bin\pactia.exe` and updates user `PATH`):

```powershell
irm https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.ps1 | iex
```

Or download `pactia-windows-x64.exe` from [Releases](https://github.com/pactia-lang/pactia/releases), rename to `pactia.exe`, and place it on your `PATH`.

The `pactia` binary includes the compiler — `pactia build` works out of the box. For the compiler CLI only, see [pactiac](https://github.com/pactia-lang/pactiac).

For development and programmatic use, `npm run build` → `dist/cli.js` remains available.

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
    commands/         init, add, install, update, build, why, publish
    vendor/           lock → .pactia/packages/
    workspace/        find pactia.toml + product.pactia
  scripts/
    install-hooks.sh
    install-pactia.sh
    install-pactia.ps1
    smoke-binary.sh
  .githooks/          pre-commit (test), pre-push (test)
  .github/workflows/  CI on Node 20 and 22; release on tags
```

## License

MIT — see [LICENSE](LICENSE).
