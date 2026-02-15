# ProofMark

A desktop markdown editor for static site publishers. Write, preview, and publish content to your Astro site with integrated media management.

## The Name

**ProofMark** combines two concepts central to the app's workflow:

- **Proof** — Like a printer's proof, you preview and verify content before publication. The split-view editor lets you see exactly how your markdown will render.
- **Mark** — Short for markdown, the format you write in. Also "make your mark" — publish your words to the web.

Together, *proofmark* echoes the traditional printing term for a mark authenticating a proof copy.

## Features

- Create and edit blog posts, projects, pieces, and notes
- Live markdown preview with GitHub-flavored markdown
- Split, write-only, and preview-only view modes
- Image and video picker from local media library
- Cloudinary CDN integration with automatic upload and URL rewriting
- One-click publish (sync media → rewrite URLs → commit → push)
- Git status display with pull/push controls
- Cross-platform: macOS, Linux (including Raspberry Pi)

## Installation

### From Source

```bash
# Clone the repository
git clone git@github.com:Setanta72/casey-editor-desktop.git
cd casey-editor-desktop

# Install dependencies
npm install

# Run directly
npx vite build && npx electron .

# Or build a native app
npm run build:mac    # macOS .app
npm run build:linux  # Linux AppImage
```

### Native App

After building, the app is in `release/`:
- **macOS**: Move `ProofMark.app` to `/Applications/`
- **Linux**: Run the `.AppImage` directly or move to `~/Applications/`

## First Run

On first launch, configure:

1. **Website Directory** — Your Astro site folder (containing `src/content/`)
2. **Media Library** — Your local image/video folder (e.g., `~/Media/`)
3. **Cloudinary Credentials** — Cloud name, API key, and secret

Configuration is stored in:
- **macOS**: `~/Library/Application Support/proofmark/config.json`
- **Linux**: `~/.config/proofmark/config.json`

Cloudinary credentials via environment variables:
```bash
export CLOUDINARY_API_KEY="your-key"
export CLOUDINARY_API_SECRET="your-secret"
```

## Usage

### Writing

1. Select content type from sidebar (Posts, Projects, Pieces, Notes)
2. Click **+ New** or select existing file
3. Edit frontmatter in the right panel
4. Write markdown in the editor
5. **Ctrl+S** to save

### Media

1. Click the image icon in toolbar
2. Browse your media library
3. Click to insert — images use markdown syntax, videos use HTML `<video>` tags
4. Local `/media/` paths are rewritten to Cloudinary URLs on publish

### Publishing

1. Save your changes (**Ctrl+S**)
2. Click **Publish** in sidebar
3. App syncs media to Cloudinary, rewrites URLs, commits, and pushes
4. Your CI/CD rebuilds the site automatically

## Requirements

- **Git** configured with SSH access to your repository
- **Node.js** 18+ (for development/building)
- **Cloudinary account** (free tier sufficient)

## Project Structure

```
proofmark/
├── electron/              # Electron main process
│   ├── main.ts           # App entry, window management
│   ├── preload.ts        # Context bridge for IPC
│   ├── config-store.ts   # Persistent configuration
│   └── server/           # Embedded Express API
│       ├── index.ts      # API routes
│       └── media-sync.ts # Cloudinary upload logic
├── src/                  # React frontend
│   ├── components/       # UI components
│   │   ├── Dashboard.tsx
│   │   ├── Editor.tsx
│   │   ├── FileList.tsx
│   │   └── Sidebar.tsx
│   └── config.ts         # API URL, constants
├── build/                # App icons
├── dist/                 # Built frontend (Vite output)
├── dist-electron/        # Built Electron code
└── release/              # Packaged applications
```

## License

MIT
