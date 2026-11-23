# Changelog

## 0.2.0

- **Number counter**: tick "Number counter" and the Controller gets a **Number** slider. Keyframe it
  (e.g. 0 -> 1250) and every digit slot swaps to the matching digit glyph of the font. Leading zeros
  and separators that do not belong to the current number are hidden (or shown with "Show leading
  zeros"); "Decimals" is detected from the text ("$1,250.00" -> 2) and can be changed.
- **Alignment** for the counter (left / center / right): an **Alignment** slider on the Controller (0 / 50 / 100)
  packs the visible digits and aligns them inside the block of the typed text.
- **Clear** button: resets the whole panel to its initial state.

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
