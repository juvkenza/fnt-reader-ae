/* Parser for BMFont (.fnt) files in text or XML format.
   Plain JS: works in the panel (browser) and in Node (tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FntParser = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Turns `key=value key2="value with spaces"` into an object.
  function parseKeyValues(line) {
    var out = {};
    var re = /(\w+)=("([^"]*)"|\S*)/g;
    var m;
    while ((m = re.exec(line))) {
      var raw = m[3] !== undefined ? m[3] : m[2];
      var isText = m[1] === "face" || m[1] === "file" || m[1] === "charset";
      out[m[1]] = isText || isNaN(Number(raw)) || raw === "" ? raw : Number(raw);
    }
    return out;
  }

  function parse(text) {
    var font = { info: {}, common: {}, pages: [], chars: {}, kernings: {} };
    text = String(text).replace(/^﻿/, "");

    function handle(tag, kv) {
      switch (tag) {
        case "info": font.info = kv; break;
        case "common": font.common = kv; break;
        case "page": font.pages[kv.id || 0] = kv.file; break;
        case "char": font.chars[kv.id] = kv; break;
        case "kerning":
          (font.kernings[kv.first] = font.kernings[kv.first] || {})[kv.second] = kv.amount;
          break;
      }
    }

    if (/^BMF/.test(text)) {
      throw new Error("This .fnt is in the binary BMFont format. Export it as Text or XML (BMFont / Shoebox).");
    }
    if (/^\s*<(\?xml|font)/i.test(text)) {
      // BMFont as XML: <info .../> <common .../> <page .../> <char .../> <kerning .../>
      var re = /<(info|common|page|char|kerning)\s([^>]*?)\/?>/g, m;
      while ((m = re.exec(text))) handle(m[1], parseKeyValues(m[2]));
    } else {
      var lines = text.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var tag = line.split(/\s+/, 1)[0];
        handle(tag, parseKeyValues(line.slice(tag.length)));
      }
    }
    if (!font.common.lineHeight || !Object.keys(font.chars).length || !font.pages.length) {
      throw new Error("Invalid .fnt file: missing 'common', 'page' or 'char'. Is it really a BMFont (text/XML)?");
    }
    for (var p = 0; p < font.pages.length; p++) {
      if (!font.pages[p]) throw new Error("Invalid .fnt file: page " + p + " has no image file.");
    }
    return font;
  }

  function kerningFor(font, first, second) {
    var row = font.kernings[first];
    return row && row[second] ? row[second] : 0;
  }

  return { parse: parse, kerningFor: kerningFor };
});
