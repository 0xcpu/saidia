#!/bin/bash

echo "Building Saidia Extension..."

mkdir -p dist
mkdir -p images

echo "Copying files to dist directory..."
cp manifest.json dist/
cp popup.html dist/
cp popup.js dist/
cp content.js dist/
cp background.js dist/
cp -r images dist/

echo "Build complete. Files are in the 'dist' directory."
