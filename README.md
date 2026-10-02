# ROOT File Viewer (Forked)

This is a fork of the original [ROOT File Viewer](https://github.com/AlbertoPdRF/root-file-viewer). This fork adds support for viewing THn and THnSparse histograms, as well as fixes latex rendering for 3D viewer (TH2 draw 3D, TH3, 3+D THn).

ROOT File Viewer allows you to see your ROOT Files directly in VS Code! This extension is for you if you want to view ROOT Files:

- with just a click, without having to type anything on a terminal
- anywhere, with no local ROOT installation required

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
# First install nvm (Node Version Manager) https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash

# actually install Node.js
nvm install 24

# check that the correct version is being used
node -v

# get yarn from nvm
corepack enable

# compile
npx @vscode/vsce package

# install the extension in VS Code
code --install-extension root-file-viewer-THn-1.7.0.vsix
```