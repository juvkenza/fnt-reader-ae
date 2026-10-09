# Changelog

## 0.1.0

First release.

- Reads BMFont `.fnt` files (text or XML, one or more pages) with their `.png` atlases.
- Live preview and BMFont/Godot-style layout; per-letter kerning, Y offset, scale and rotation.
- Draggable number fields like After Effects (Shift ×10, Ctrl ×0.1).
- Builds a composition with one layer per letter (the atlas masked to the glyph), parented to a
  centered guide shape layer called "Controller" with Size / Tracking / Line Height sliders.
- Edit existing compositions: "Load from active comp" and "Update composition"; the comp is
  resized to the text plus margin on every update.
- Windows and macOS, distributed as a signed `.zxp`.
