# FNT Reader for After Effects

Use bitmap fonts (**`.fnt` + `.png`**, the BMFont format that game engines such as Godot read) in After Effects. Type a word, tweak the spacing, and get a composition with **one layer per letter**, ready to animate.

![license](https://img.shields.io/github/license/juvkenza/fnt-reader-ae) ![release](https://img.shields.io/github/v/release/juvkenza/fnt-reader-ae) ![platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

After Effects can import the `.png` atlas but not the `.fnt` that describes it. FNT Reader reads the `.fnt` and lays the text out exactly like a game engine would (advance, offsets, kerning), so what you animate matches what ships in the game.

## Features

- Reads BMFont `.fnt` files in text or XML format, including multi-page fonts and kerning pairs.
- Live preview with a checkerboard/dark/light background.
- Size, tracking and line height, plus per-letter kerning, Y offset, scale and rotation.
- Number fields behave like After Effects: drag to scrub, **Shift** for bigger steps, **Ctrl** for fine steps.
- Builds a composition where each letter is its own layer (the atlas masked to the glyph, anchor point at the glyph center). The comp is sized to the text plus a margin.
- A centered guide shape layer, **Controller**, parents every letter and exposes **Size**, **Tracking** and **Line Height** sliders, so you can still adjust the text from the timeline.
- Edit existing comps: load a comp's font and settings back into the panel and update it in place, without recreating it. Properties you keyframed are left untouched.

## Install

Requires After Effects 2021 (18.0) or newer on Windows or macOS.

1. Download `FNTReader-vX.Y.Z.zxp` from the [latest release](https://github.com/juvkenza/fnt-reader-ae/releases/latest).
2. Install it with [ZXPInstaller](https://zxpinstaller.com/) (drag the file onto its window).
3. Restart After Effects and open **Window > Extensions > FNT Reader**.

On macOS, the first time you open ZXPInstaller you may need to right-click it and choose **Open**.

The `.zxp` is signed with a self-signed certificate, so no debug mode or registry tweaks are needed.

## Use

1. Click **Open .fnt…** and pick your font. The `.png` page(s) must be in the same folder.
2. Type your text. Adjust size, tracking and line height.
3. Click a letter in the preview to adjust it on its own (kerning, Y, scale, rotation; arrow keys nudge kerning and Y).
4. Click **Create composition**.

To change it later, select the comp and click **Load from active comp**, edit, then **Update composition**. If the original `.fnt` was moved, the panel asks you to locate it.

## Supported fonts

| | |
|---|---|
| BMFont text format | yes |
| BMFont XML format | yes |
| Several pages / kerning pairs | yes |
| BMFont binary format | no (export as text or XML) |
| Packed channels (`packed=1`) | no |

## Development

```
src/core    plain JS: .fnt parser and layout (no DOM, no AE)
src/panel   the panel UI (HTML/CSS/JS, canvas preview)
src/host    ExtendScript that builds and updates compositions
src/CSXS    CEP manifest
tests       node:test suite
samples     a generated demo font (samples/demo.fnt + demo.png)
tools       make-demo-font.js
scripts     dev-link.* (run the panel from this checkout), build-zxp.ps1
```

- Run the tests: `npm test`
- Open `src/panel/index.html` in a browser for a preview-only mode (pick `samples/demo.fnt` and `samples/demo.png`).
- Load the panel into After Effects straight from the repository: `scripts\dev-link.ps1` (Windows) or `bash scripts/dev-link.sh` (macOS). This enables CEP's `PlayerDebugMode`; undo it with `-Remove` / `--remove`.
- Build the `.zxp` locally: `scripts\build-zxp.ps1` (Windows).
- Release: bump the version in `src/CSXS/manifest.xml` (two places) and `CHANGELOG.md`, then `git tag vX.Y.Z && git push --tags`. GitHub Actions runs the tests, builds the signed `.zxp` and publishes the release.

The panel is built on CEP. Adobe is moving After Effects to UXP; only `src/panel` and `src/host` would need to change.

## License

[MIT](LICENSE)
