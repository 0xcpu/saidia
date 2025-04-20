#!/bin/bash

echo "Building Saidia Extension..."

mkdir -p dist
mkdir -p images

echo "Copying files to dist directory..."
cp manifest.json dist/
cp popup.html dist/
cp *.js dist/
cp -r images dist/

echo "Build complete. Files are in the 'dist' directory."
