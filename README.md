# EasyEDA-Hackatime

Track your PCB design time in [EasyEDA Pro](https://easyeda.com/) with [Hackatime](https://hackatime.hackclub.com/).

## Installation

### Option 1: Download Release (Recommended)

1. Go to [Actions](https://github.com/wenfeng110402/EasyEDA-hackatime/actions) tab
2. Click on the latest successful workflow run
3. Download the `.eext` file from the **Artifacts** section
4. Open [EasyEDA Pro](https://easyeda.com/page/download)
5. Go to **Settings > Extensions > Extension Manager**
6. Click **Import Extensions** and select the downloaded `.eext` file
7. Click the text under **"External Interactions"** to enable network access

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/wenfeng110402/EasyEDA-hackatime.git
cd EasyEDA-hackatime
cd plugin

# Install dependencies (requires Node.js >= 20.17.0)
npm install

# Build the extension
npm run build
```

The `.eext` file will be generated in `./build/dist`.

## Setup

1. Open **Hackatime > Settings**
2. Enter your API Key from [hackatime.hackclub.com](https://hackatime.hackclub.com/)
3. Click **Save**
4. Start designing!

## Development

### Automatic Builds

This project uses GitHub Actions to automatically build the extension on every push to the main branch. You can download the latest build from the [Actions](https://github.com/wenfeng110402/EasyEDA-hackatime/actions) tab.

### Local Development

```bash
npm run build    # Build the extension
npm run compile  # Compile TypeScript only
npm run lint     # Check code style
npm run fix      # Auto-fix code style issues
```

## Acknowledgements

Some code adapted from [easyeda-wakatime](https://github.com/radeeyate/easyeda-wakatime) by [radeeyate](https://github.com/radeeyate).
