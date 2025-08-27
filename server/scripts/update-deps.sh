#!/bin/bash
# Script to update Python dependencies using pip-tools

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"
REQ_IN="$PROJECT_DIR/requirements.in"
REQ_TXT="$PROJECT_DIR/requirements.txt"
# Ensure commands run in the project dir
cd "$PROJECT_DIR"

echo "🔄 Updating Python dependencies..."
# Check if pip-tools is installed
if ! command -v pip-compile &> /dev/null; then
    echo "❌ pip-tools not found. Installing..."
    pip install pip-tools
fi

echo "📦 Regenerating $REQ_TXT with hashes..."
"$PYTHON" -m piptools compile --generate-hashes "$REQ_IN" -o "$REQ_TXT"

echo "⬇️ Installing updated dependencies from $REQ_TXT..."
"$PYTHON" -m piptools sync "$REQ_TXT"

echo "✅ Dependencies updated successfully!"
echo "📋 Summary:"
echo "  - requirements.in: Top-level dependencies"
echo "  - requirements.txt: Pinned dependencies with hashes"
echo ""
echo "💡 To update a specific package:"
echo "  1. Edit requirements.in"
echo "  2. Run: ./scripts/update-deps.sh"
