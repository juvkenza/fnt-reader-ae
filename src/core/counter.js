/* Number-counter helpers. Plain JS, no DOM and no AE.

   "Counter" mode lets a Controller slider ("Number") drive which digit glyph each digit
   slot of the text shows, so a value can be keyframed (e.g. 0 -> 1250) and the font's own
   digits count up. Slots keep the spacing of the text that was typed. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FntCounter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var MAX_SLOTS = 15; // keeps the integer value exact in floating point

  // Glyph rectangles/offsets for the digits 0-9, or { ok: false, reason }.
  function digitTables(font) {
    var t = { sx: [], sy: [], sw: [], sh: [], xo: [], yo: [] };
    var page = null;
    for (var d = 0; d <= 9; d++) {
      var def = font.chars[48 + d];
      if (!def || !(def.width > 0) || !(def.height > 0)) {
        return { ok: false, reason: "this font has no glyph for the digit " + d };
      }
      var p = def.page || 0;
      if (page === null) page = p;
      else if (p !== page) return { ok: false, reason: "the digits are on different atlas pages" };
      t.sx.push(def.x); t.sy.push(def.y); t.sw.push(def.width); t.sh.push(def.height);
      t.xo.push(def.xoffset); t.yo.push(def.yoffset);
    }
    return { ok: true, page: page, t: t };
  }

  // Number of digits after the last "." (e.g. "$1,250.00" -> 2); 0 when there is none.
  function detectDecimals(text) {
    var m = /\.(\d+)[^\d]*$/.exec(String(text));
    return m ? m[1].length : 0;
  }

  // The number the typed text represents: every digit in order, shifted by `decimals`.
  function typedNumber(text, decimals) {
    var digits = String(text).replace(/\D/g, "");
    if (!digits) return 0;
    return parseInt(digits, 10) / Math.pow(10, decimals || 0);
  }

  // Marks every glyph of a layout as a digit slot (slot = 0..N-1) or as a separator that
  // follows `before` digit slots. Returns the number of slots.
  function annotate(glyphs) {
    var n = 0;
    glyphs.forEach(function (g) {
      if (g.id >= 48 && g.id <= 57) { g.slot = n; n++; }
      else { g.slot = -1; g.before = n; }
    });
    return n;
  }

  return {
    MAX_SLOTS: MAX_SLOTS,
    digitTables: digitTables,
    detectDecimals: detectDecimals,
    typedNumber: typedNumber,
    annotate: annotate
  };
});
