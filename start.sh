#!/bin/bash
# Start Casey Editor Desktop

cd "$(dirname "$0")"

# Kill any existing instances
pkill -f "casey-editor-desktop" 2>/dev/null

# Check if built
if [ ! -f "dist/index.html" ]; then
    echo "Building app..."
    npm run dev -- --mode production &
    BUILD_PID=$!
    sleep 5
    kill $BUILD_PID 2>/dev/null
    npx vite build
fi

echo "Starting Casey Editor..."
npx electron .
