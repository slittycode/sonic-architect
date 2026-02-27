#!/bin/bash

echo "🎵 Installing Sonic Architect CLI..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   curl -fsSL https://get.pnpm.io/install.sh | sh -"
    exit 1
fi

# Link globally
pnpm link --global

echo ""
echo "✅ Installation complete!"
echo ""
echo "Usage:"
echo "  sonic    - Launch Sonic Architect from any directory"
echo ""
echo "To uninstall:"
echo "  pnpm unlink --global"