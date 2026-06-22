# pactia

Package manager for Pactia workspaces. Resolves dependencies, vendors packages, and runs builds. Invokes [pactiac](https://github.com/pactia-lang/pactiac) (the compiler) under the hood.

## Commands

```bash
pactia init <dir> [--name <ProductName>] [--stack rust-stack|html-css-js]
pactia add <@scope/name> [range] [-C <workspace-dir>]
pactia fetch [-C <workspace-dir>]
pactia build [-C <workspace-dir>] [-o <output-dir>]   # default output: out/
```

`pactia fetch` and `pactia build` resolve semver ranges, write `pactia.lock`, download dependencies into the global cache, and copy pinned packages into the workspace vendor directory. Set `PACTIA_VENDOR_ROOT` for a local package index during development (instead of git fetch).

Planned: `publish`.

## Package storage

After `pactia fetch` (or `pactia build`, which fetch-then-compiles), packages live in two places:

- **`~/.pactia/packages/`** — global cache where fetch downloads or copies packages (git clone, or from `PACTIA_VENDOR_ROOT`)
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
  .pactia/packages/     # vendored deps (copied from ~/.pactia/packages/ on fetch/build)
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

Release assets (`pactia-linux-x64`, `pactia-darwin-arm64`, …) are published on version tags via `.github/workflows/release.yml`.

Install from GitHub Releases:

```bash
curl -fsSL https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.sh | bash
./scripts/install-pactia.sh v0.1.0
```

**You do not need a separate `pactiac` install** for `pactia build` — the compiler is embedded in the `pactia` binary. Install `pactiac` only if you want the standalone `pactiac compile` command:

```bash
./scripts/install-pactia.sh --with-pactiac
# or: WITH_PACTIAC=1 curl -fsSL .../install-pactia.sh | bash
# optional: PACTIAC_VERSION=v0.1.0 when pactiac tag differs from pactia
```

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
    commands/         init, add, fetch, build
    vendor/           lock → .pactia/packages/
    workspace/        find pactia.toml + product.pactia
  scripts/
    install-hooks.sh
    install-pactia.sh
    smoke-binary.sh
  .githooks/          pre-commit (test), pre-push (test)
  .github/workflows/  CI on Node 20 and 22; release on tags
```

## License

MIT — see [LICENSE](LICENSE).
