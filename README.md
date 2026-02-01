# Casey Editor Desktop

A standalone desktop application for managing content on your Casey website.

## Features

- Create and edit blog posts, projects, pieces, and notes
- Live markdown preview with GitHub-flavored markdown
- Image picker from your media library
- Cloudinary CDN integration for images
- One-click publish (sync images + commit + push)
- Secure credential storage using system keychain

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for current platform
npm run build

# Build for Linux
npm run build:linux

# Build for macOS
npm run build:mac
```

## First Run

On first launch, the setup wizard will guide you through:

1. **Website Directory** - Select your Astro site folder (containing `src/content/`)
2. **Media Library** - Select your image library folder
3. **Cloudinary Credentials** - Enter your cloud name, API key, and secret

Credentials are stored securely in your system keychain.

## Requirements

- **Git** must be installed and configured for your repository
- **Node.js** 18+ for development

## Project Structure

```
casey-editor-desktop/
├── electron/           # Electron main process
│   ├── main.ts        # App entry point
│   ├── preload.ts     # Context bridge
│   ├── config-store.ts # Secure storage
│   └── server/        # Embedded Express API
├── src/               # React frontend
│   ├── components/    # UI components
│   └── config.ts      # App configuration
├── dist/              # Built frontend
├── dist-electron/     # Built Electron code
└── release/           # Packaged applications
```
