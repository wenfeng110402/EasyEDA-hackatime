# EasyEDA-Hackatime

Track your PCB design time in [EasyEDA Pro](https://easyeda.com/) with [Hackatime](https://hackatime.hackclub.com/).

## Installation

### Option 1: Download Release (Recommended)

1. Download the `.eext` file from the [Releases](https://github.com/wenfeng110402/EasyEDA-hackatime/releases) page.
2. Open [EasyEDA Pro](https://easyeda.com/page/download).
3. Go to **Settings > Extensions > Extension Manager**.
4. Click **Import Extensions** and select the downloaded `.eext` file.
5. Click the text under **"External Interactions"** to enable network access.

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/wenfeng110402/EasyEDA-hackatime.git
cd EasyEDA-hackatime

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

## Acknowledgements

Some code adapted from [easyeda-wakatime](https://github.com/radeeyate/easyeda-wakatime) by [radeeyate](https://github.com/radeeyate).