/* BMFont/Godot-style text layout. Plain JS, no DOM and no AE.

   layoutText(font, text, opts) returns the position (in pixels, origin at the
   top-left of the text block) of every visible glyph.

   opts:
     scale      global scale (1 = 100%)
     tracking   extra space between letters (px, before scaling)
     lineHeight line height (px); defaults to font.common.lineHeight
     overrides  { [letterIndex]: { kern, dy, scale, rot } }
                index counts every character of the text, excluding '\n' */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./fntParser.js"));
  else root.FntLayout = factory(root.FntParser);
})(typeof self !== "undefined" ? self : this, function (FntParser) {
  function layoutText(font, text, opts) {
    opts = opts || {};
    var scale = opts.scale == null ? 1 : opts.scale;
    var tracking = opts.tracking || 0;
    var lineHeight = (opts.lineHeight == null ? font.common.lineHeight : opts.lineHeight) * scale;
    var overrides = opts.overrides || {};

    var glyphs = [];
    var missing = [];
    var maxWidth = 0;
    var line = 0;
    var cursor = 0;
    var prevId = null;
    var index = 0;
    var count = 0; // letters already advanced on the current line
    var counts = [];

    // Array.from walks code points (handles characters outside the BMP)
    var chars = Array.from(String(text));
    for (var n = 0; n < chars.length; n++) {
      var ch = chars[n];
      if (ch === "\r") continue;
      if (ch === "\n") {
        maxWidth = Math.max(maxWidth, cursor - (count ? tracking * scale : 0));
        counts.push(count);
        line++; cursor = 0; prevId = null; count = 0;
        continue;
      }
      var id = ch.codePointAt(0);
      var def = font.chars[id];
      var ov = overrides[index] || {};
      var letterScale = scale * (ov.scale == null ? 1 : ov.scale);

      if (!def) {
        if (missing.indexOf(ch) < 0) missing.push(ch);
        index++;
        continue;
      }

      var kern = prevId == null ? 0 : FntParser.kerningFor(font, prevId, id);
      cursor += kern * scale + (ov.kern || 0) * scale;

      if (def.width > 0 && def.height > 0) {
        var w = def.width * letterScale;
        var h = def.height * letterScale;
        glyphs.push({
          index: index,
          char: ch,
          id: id,
          // rectangle in the atlas (png)
          sx: def.x, sy: def.y, sw: def.width, sh: def.height,
          // destination rectangle (top-left corner), before rotation
          x: cursor + def.xoffset * scale + (def.width * scale - w) / 2,
          y: line * lineHeight + def.yoffset * scale + (ov.dy || 0) * scale + (def.height * scale - h) / 2,
          w: w,
          h: h,
          scale: letterScale,
          rot: ov.rot || 0,
          page: def.page || 0,
          line: line,
          n: count
        });
      }

      cursor += def.xadvance * scale + tracking * scale;
      prevId = id;
      count++;
      index++;
    }
    counts.push(count);
    maxWidth = Math.max(maxWidth, cursor - (count ? tracking * scale : 0));

    return {
      glyphs: glyphs,
      missing: missing,
      lines: line + 1,
      counts: counts, // number of advanced letters per line
      width: Math.max(0, maxWidth),
      height: (line + 1) * lineHeight
    };
  }

  return { layoutText: layoutText };
});
