<img src="clippyaiicon.png" width="50px" height="50px">

# clippy.ai

A private, git-friendly, local-first bookmarking and research tool with optional AI power-ups 🚀

## Features

- Bookmark websites and assign a fixed ID for reference in hand-written notes.
- Summarize websites using Gemini models and add your own tags and notes in the app.
- Quickly find bookmarks using fuzzy search.
- Data is stored in a JSON file - easily checked into git.
- Manage multiple workspace files for separation between areas of life.
- Quickly pull and push with built in git commands.

## Development

### Prerequisites

- **Node.js ≥ 18**

- **Rust**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

- **System libraries (Linux)**

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  build-essential \
  curl \
  wget \
  file \
  libgtk-3-dev
```

### Build/dev commands

```bash
npm install
npm run tauri dev
```

```bash
npm run tauri build
```

More build options can be found [here](https://tauri.app/reference/cli/#build).

The packaged app will be in `src-tauri/target/release/bundle/`.

## License

Licensed under the MIT license.