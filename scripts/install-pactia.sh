#!/usr/bin/env bash
# Install pactia native binary from GitHub Releases.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.sh | bash
#   ./scripts/install-pactia.sh [version]
#   ./scripts/install-pactia.sh --with-pactiac [version]
#   WITH_PACTIAC=1 ./scripts/install-pactia.sh
#
# pactia bundles the compiler for `pactia build`. --with-pactiac is optional and
# only needed for the standalone `pactiac compile` CLI.
set -euo pipefail

pactia_repo="pactia-lang/pactia"
pactiac_repo="pactia-lang/pactiac"
version="latest"
with_pactiac=false

usage() {
  cat <<'EOF'
install-pactia.sh — install pactia from GitHub Releases

Usage:
  install-pactia.sh [--with-pactiac] [version]

Options:
  --with-pactiac   Also install the standalone pactiac compiler binary
                   (not required for pactia init/fetch/add/build)

Environment:
  INSTALL_DIR      Target directory (default: ~/.local/bin)
  WITH_PACTIAC=1   Same as --with-pactiac
  PACTIAC_VERSION  pactiac release tag when using --with-pactiac
                   (default: same tag as pactia, or latest)

Examples:
  ./scripts/install-pactia.sh
  ./scripts/install-pactia.sh v0.1.1
  ./scripts/install-pactia.sh --with-pactiac
  WITH_PACTIAC=1 curl -fsSL .../install-pactia.sh | bash
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-pactiac)
      with_pactiac=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "install-pactia: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      version="$1"
      shift
      ;;
  esac
done

if [[ "${WITH_PACTIAC:-}" == "1" || "${WITH_PACTIAC:-}" == "true" ]]; then
  with_pactiac=true
fi

detect_platform() {
  case "$(uname -s)" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *)
      echo "install-pactia: unsupported OS $(uname -s)" >&2
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64 | amd64) arch="x64" ;;
    aarch64 | arm64) arch="arm64" ;;
    *)
      echo "install-pactia: unsupported arch $(uname -m)" >&2
      exit 1
      ;;
  esac
}

resolve_release_tag() {
  local repo="$1"
  local requested="$2"
  local api
  if [[ "$requested" == "latest" ]]; then
    api="https://api.github.com/repos/${repo}/releases/latest"
  else
    api="https://api.github.com/repos/${repo}/releases/tags/${requested}"
  fi
  curl -fsSL "$api" | sed -n 's/.*"tag_name": "\([^"]*\)".*/\1/p' | head -1
}

download_binary() {
  local repo="$1"
  local name="$2"
  local tag="$3"
  local dest="$4"

  local asset="${name}-${os}-${arch}"
  local url="https://github.com/${repo}/releases/download/${tag}/${asset}"

  echo "install-pactia: downloading ${tag} ${asset}"
  curl -fsSL "$url" -o "$dest"
  chmod +x "$dest"
}

detect_platform

pactia_tag="$(resolve_release_tag "$pactia_repo" "$version")"
if [[ -z "$pactia_tag" ]]; then
  echo "install-pactia: could not resolve pactia release for '${version}'" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

download_binary "$pactia_repo" "pactia" "$pactia_tag" "$tmpdir/pactia"

if [[ "$with_pactiac" == true ]]; then
  pactiac_version="${PACTIAC_VERSION:-$version}"
  pactiac_tag="$(resolve_release_tag "$pactiac_repo" "$pactiac_version")"
  if [[ -z "$pactiac_tag" ]]; then
    echo "install-pactia: could not resolve pactiac release for '${pactiac_version}'" >&2
    exit 1
  fi
  download_binary "$pactiac_repo" "pactiac" "$pactiac_tag" "$tmpdir/pactiac"
fi

install_dir="${INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$install_dir"
install -m 755 "$tmpdir/pactia" "$install_dir/pactia"

echo "install-pactia: installed pactia ${pactia_tag} -> ${install_dir}/pactia"
echo "install-pactia: pactia build includes the compiler (no separate pactiac required)"

if [[ "$with_pactiac" == true ]]; then
  install -m 755 "$tmpdir/pactiac" "$install_dir/pactiac"
  echo "install-pactia: installed pactiac ${pactiac_tag} -> ${install_dir}/pactiac"
fi

echo "install-pactia: ensure ${install_dir} is on your PATH"
