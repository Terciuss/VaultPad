#!/usr/bin/env bash
set -euo pipefail

PRODUCT="VaultPad"
VERSION=$(grep '"version"' src-tauri/Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
BUNDLE_DIR="src-tauri/target/release/bundle"
OUT_DIR="dist-artifacts"

case "$(uname -s)" in
    Darwin)  OS="macOS" ;;
    Linux)   OS="Linux" ;;
    MINGW*|MSYS*|CYGWIN*) OS="Windows" ;;
    *)       OS="Unknown" ;;
esac

case "$(uname -m)" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="x64" ;;
    *)             ARCH="$(uname -m)" ;;
esac

mkdir -p "$OUT_DIR"

copied=0

if [ "$OS" = "macOS" ]; then
    for f in "$BUNDLE_DIR"/dmg/*.dmg; do
        [ -f "$f" ] || continue
        cp "$f" "$OUT_DIR/${PRODUCT}-${OS}-${ARCH}.dmg"
        echo "  -> ${PRODUCT}-${OS}-${ARCH}.dmg"
        copied=$((copied + 1))
    done
fi

if [ "$OS" = "Windows" ]; then
    for f in "$BUNDLE_DIR"/nsis/*.exe; do
        [ -f "$f" ] || continue
        cp "$f" "$OUT_DIR/${PRODUCT}-${OS}-${ARCH}-setup.exe"
        echo "  -> ${PRODUCT}-${OS}-${ARCH}-setup.exe"
        copied=$((copied + 1))
    done
fi

if [ "$OS" = "Linux" ]; then
    for f in "$BUNDLE_DIR"/appimage/*.AppImage; do
        [ -f "$f" ] || continue
        cp "$f" "$OUT_DIR/${PRODUCT}-${OS}-${ARCH}.AppImage"
        echo "  -> ${PRODUCT}-${OS}-${ARCH}.AppImage"
        copied=$((copied + 1))
    done
fi

if [ "$copied" -eq 0 ]; then
    echo "No artifacts found in $BUNDLE_DIR"
    exit 1
fi

echo "Done: $copied artifact(s) copied to $OUT_DIR/"
