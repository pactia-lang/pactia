#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

binary="${1:-$root/dist/pactia-linux-x64}"
pactiac_root="${PACTIAC_ROOT:-$root/../pactiac}"
vendor_root="$pactiac_root/test/fixtures/packages"
website_workspace="$pactiac_root/test/fixtures/workspace/website"
out_dir="$(mktemp -d /tmp/pactia-bin-smoke.XXXXXX)"
demo_dir="$(mktemp -d /tmp/pactia-bin-init.XXXXXX)"

cleanup() {
  rm -rf "$out_dir" "$demo_dir"
}
trap cleanup EXIT

if [[ ! -x "$binary" ]]; then
  echo "smoke-binary: missing executable: $binary" >&2
  exit 1
fi

if [[ ! -d "$vendor_root" ]]; then
  echo "smoke-binary: missing vendor fixtures at $vendor_root (set PACTIAC_ROOT)" >&2
  exit 1
fi

export PACTIA_VENDOR_ROOT="$vendor_root"

"$binary" build -C "$website_workspace" -o "$out_dir"
test -f "$out_dir/input/product.json"

"$binary" init "$demo_dir/demo" --name SmokeDemo
"$binary" add rust-stack -C "$demo_dir/demo"
"$binary" build -C "$demo_dir/demo" -o "$demo_dir/out"
test -f "$demo_dir/out/input/product.json"

echo "smoke-binary: OK ($binary)"
