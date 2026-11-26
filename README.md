# ROOT File Viewer (Forked)

This is a fork of the original [ROOT File Viewer](https://github.com/AlbertoPdRF/root-file-viewer). This fork adds:
- support for viewing THn and THnSparse histograms
- fixes latex rendering for 3D viewer (TH2 draw 3D, TH3, 3+D THn).
- option to copy path from each element in menu
- selectable text in menu
- rebin for 2D histograms (also for 2D `TEfficiency`: passed and total histograms are combined rather than averaging the drawn efficiencies)
- projections of 2D histograms are drawn with error bars (asymmetric for `TEfficiency`)
- projections use log y by default when log z is enabled

ROOT File Viewer allows you to see your ROOT Files directly in VS Code! This extension is for you if you want to view ROOT Files:
- with just a click, without having to type anything on a terminal
- anywhere, with no local ROOT installation required

Fixes:
- Fix 2D histogram XYall projection behaving like XY1
- Fix `TEfficiency` bin combination in rebin and projections
- Fix real 0 cells of a 2D `TEfficiency` (total > 0) being drawn as empty instead of with the lowest color

![Demo GIF](demo.gif)

## Installation

Installing the extension is as easy as:

1. Launching VS Code's `Quick Open` with `Ctrl + P`
2. Pasting `ext install albertopdrf.root-file-viewer` into it
3. Pressing `Enter`

And that's it, now you can view your ROOT Files directly in VS Code! 🎉

You can also install the extension with any of the other [options supported by VS Code](https://code.visualstudio.com/docs/editor/extension-gallery)

## Development

To build and run the extension locally, follow these steps:

1. Clone the repo with `git clone git@github.com:AlbertoPdRF/root-file-viewer.git` (or `git clone https://github.com/AlbertoPdRF/root-file-viewer.git`)
2. Move into just created folder folder with `cd root-file-viewer`
3. Install the dependencies with `yarn`
4. Run the extension pressing `F5`

## Compiling locally
```bash
# 1. Install nvm (Node Version Manager) https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash

# Restart your terminal or reload your shell configuration first if needed.

# 2. Install and select Node.js
nvm install 24
nvm use 24
node -v

# 3. Enable the package manager
corepack enable
yarn --version

# 4. Install dependencies declared by the project
yarn install

# 5. Package the extension
npx @vscode/vsce package

# 6. Install the generated VSIX
code --install-extension ./root-file-viewer-THn-1.7.1.vsix
```