#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET_ROOT="${1:-$(cd "$ROOT_DIR/.." && pwd)}"
APP_REPO="$TARGET_ROOT/sonic-architect-app"
LAB_REPO="$TARGET_ROOT/sonic-architect-lab"
APP_MANIFEST="$ROOT_DIR/scripts/refactor/path-manifests/app-paths.txt"
LAB_MANIFEST="$ROOT_DIR/scripts/refactor/path-manifests/lab-paths.txt"

if [[ -e "$APP_REPO" || -e "$LAB_REPO" ]]; then
  echo "Target repos already exist at $TARGET_ROOT. Remove or choose another target root." >&2
  exit 1
fi

mkdir -p "$TARGET_ROOT"

echo "[split] creating app repo clone..."
git clone --no-hardlinks "$ROOT_DIR" "$APP_REPO"

echo "[split] filtering app repo paths..."
(
  cd "$APP_REPO"
  mapfile -t app_paths < "$APP_MANIFEST"
  args=()
  for p in "${app_paths[@]}"; do
    [[ -z "$p" ]] && continue
    args+=(--path "$p")
  done
  git filter-repo --force "${args[@]}"
)

echo "[split] creating lab repo clone..."
git clone --no-hardlinks "$ROOT_DIR" "$LAB_REPO"

echo "[split] filtering lab repo paths..."
(
  cd "$LAB_REPO"
  mapfile -t lab_paths < "$LAB_MANIFEST"
  args=()
  for p in "${lab_paths[@]}"; do
    [[ -z "$p" ]] && continue
    args+=(--path "$p")
  done
  git filter-repo --force "${args[@]}"
)

# Cross-link READMEs
if [[ -f "$APP_REPO/README.md" ]]; then
  cat >> "$APP_REPO/README.md" <<'APPEND'

## Repository Split

This is the production app repository.

- Lab/history repository: `../sonic-architect-lab`
- Migration note: this repo was extracted via path-based history-preserving split.
APPEND
fi

if [[ -f "$LAB_REPO/README.md" ]]; then
  cat >> "$LAB_REPO/README.md" <<'APPEND'

## Repository Split

This is the lab/history repository.

- Production app repository: `../sonic-architect-app`
- Migration note: this repo was extracted via path-based history-preserving split.
APPEND
else
  cat > "$LAB_REPO/README.md" <<'APPEND'
# Sonic Architect Lab

This repository contains non-product assets (skills, archive, plans, and historical project docs).

## Repository Split

- Production app repository: `../sonic-architect-app`
- Migration note: this repo was extracted via path-based history-preserving split.
APPEND
fi

echo "[split] done"
echo "[split] app repo: $APP_REPO"
echo "[split] lab repo: $LAB_REPO"
