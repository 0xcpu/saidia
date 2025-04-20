# Saidia - Page Analyzer

A simple Chrome browser extension that analyzes web pages for suspicious content using Anthropic's Claude AI.
For personal use, no plans to package and publish it in any store.

## Features

- Automatically analyzes web pages you visit
- Shows a warning banner for suspicious pages
- Manual analysis through popup interface
- API key management for Claude access
- Ignorelist built based on existing history and bookmarks

## Setup Instructions

### 1. Get a Claude API Key

You'll need an API key from Anthropic to use Claude:
1. Go to [Anthropic's website](https://www.anthropic.com/)
2. Create an account or sign in
3. Navigate to the API section to create an API key
4. Copy your API key

### 2. Install the Extension

#### Chrome:

1. [Load unpacked](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

### 3. Configure the Extension

1. Click on the Saidia icon
2. Paste your Claude API key in the designated field
3. Click "Save Key"

## Usage

### Automatic Mode
The extension automatically analyzes pages as you browse. If a page is detected as suspicious, a red warning banner will appear at the top of the page.

### Manual Analysis
1. Click on the Saidia icon in browser's toolbar
2. Click "Analyze This Page" to manually analyze the current page
3. View the analysis results in the popup

## Privacy Notice

This extension:
- Sends page content to Anthropic's Claude API for analysis
- Temporarily stores analysis results in your browser's local storage
- Does not collect or transmit any personal data beyond what's needed for page analysis

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `background.js`: Handles API communication with Claude
- `content.js`: Reads page content and displays warnings
- `popup.html/js`: User interface for the extension

### Building from Source

1. Clone the repository
2. Modify files as needed, use [build.sh](./build.sh) script.
3. Load the extension from `dist` directory.

## License

MIT License

## Credits

Powered by Anthropic's Claude AI API 