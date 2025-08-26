#!/bin/bash
# Script to update Python dependencies using pip-tools

set -e

echo "🔄 Updating Python dependencies..."

# Check if pip-tools is installed
if ! command -v pip-compile &> /dev/null; then
    echo "❌ pip-tools not found. Installing..."
    pip install pip-tools
fi

# Regenerate requirements.txt with hashes
echo "📦 Regenerating requirements.txt with hashes..."
pip-compile --generate-hashes requirements.in

# Install updated dependencies
echo "⬇️ Installing updated dependencies..."
pip-sync requirements.txt

echo "✅ Dependencies updated successfully!"
echo "📋 Summary:"
echo "  - requirements.in: Top-level dependencies"
echo "  - requirements.txt: Pinned dependencies with hashes"
echo ""
echo "💡 To update a specific package:"
echo "  1. Edit requirements.in"
echo "  2. Run: ./scripts/update-deps.sh"
