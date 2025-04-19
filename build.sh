#!/bin/bash

echo "Building Saidia Safari Extension..."

mkdir -p dist
mkdir -p images

if [ ! -f "images/icon16.png" ] || [ ! -f "images/icon48.png" ] || [ ! -f "images/icon128.png" ]; then
    echo "Warning: Icon files not found"
    
    # Create simple placeholder icons (blue squares) using ImageMagick if available
    if command -v convert &> /dev/null; then
        echo "Creating placeholder icons using ImageMagick..."
        convert -size 16x16 xc:#0071e3 images/icon16.png
        convert -size 48x48 xc:#0071e3 images/icon48.png
        convert -size 128x128 xc:#0071e3 images/icon128.png
        echo "Placeholder icons created. Replace with actual icons before distribution."
    fi
fi

echo "Copying files to dist directory..."
cp manifest.json dist/
cp popup.html dist/
cp *.js dist/
cp -r images dist/

echo "Build complete. Files are in the 'dist' directory."
