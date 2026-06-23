#!/usr/bin/env bash
# Install pactia from GitHub Releases (Linux and macOS).
# Picks linux-x64, darwin-arm64 (Apple Silicon), or darwin-x64 (Intel) automatically.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.sh | bash
#   ./scripts/install-pactia.sh [version]
set -euo pipefail

repo="pactia-lang/pactia"
version="${1:-latest}"

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

asset="pactia-${os}-${arch}"

if [[ "$version" == "latest" ]]; then
  api="https://api.github.com/repos/${repo}/releases/latest"
else
  api="https://api.github.com/repos/${repo}/releases/tags/${version}"
fi

tag="$(curl -fsSL "$api" | sed -n 's/.*"tag_name": "\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$tag" ]]; then
  echo "install-pactia: could not resolve release version" >&2
  exit 1
fi

url="https://github.com/${repo}/releases/download/${tag}/${asset}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "install-pactia: downloading ${tag} ${asset}"
curl -fsSL "$url" -o "$tmpdir/pactia"
chmod +x "$tmpdir/pactia"

install_dir="${INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$install_dir"
install -m 755 "$tmpdir/pactia" "$install_dir/pactia"

config_dir="${HOME}/.pactia"
config_file="${config_dir}/config.toml"
if [[ ! -f "$config_file" ]]; then
  mkdir -p "$config_dir"
  config_url="https://raw.githubusercontent.com/${repo}/main/config/config.example.toml"
  if curl -fsSL "$config_url" -o "$config_file"; then
    echo "install-pactia: wrote ${config_file}"
  else
    echo "install-pactia: warning: could not download config — copy pactia/config/config.example.toml to ${config_file}" >&2
  fi
fi

echo "install-pactia: installed to ${install_dir}/pactia"
echo "install-pactia: ensure ${install_dir} is on your PATH"
