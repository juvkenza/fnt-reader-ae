/* FNT Reader panel UI. Runs inside After Effects (CEP) and, for development,
   in a regular browser (open index.html: preview only, no comp creation). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var inCEP = !!(window.cep && window.cep.fs);
  var host = window.__adobe_cep__;

  var state = {
    font: null, imgs: [], fntPath: null, pngPaths: [],
    overrides: {}, selected: null, layout: null, view: null,
    linked: null // { id, name } of the linked comp (update mode)
  };

  var canvas = $("preview");
  var ctx = canvas.getContext("2d");

  // ---------- loading files ----------
  var sepOf = function (p) { return p.indexOf("\\") >= 0 && p.indexOf("/") < 0 ? "\\" : "/"; };
  function dirname(p) { return p.replace(/[\\/][^\\/]*$/, ""); }
  function joinPath(dir, file) { return dir + sepOf(dir) + file; }
  function fileUrl(p) {
    var u = p.replace(/\\/g, "/");
    return encodeURI("file://" + (u.charAt(0) === "/" ? "" : "/") + u);
  }

  // Loads the atlas pages (pngs) and only then activates the font. imgUrls/pngPaths: one per page.
  function setFont(font, fntPath, imgUrls, pngPaths, settings) {
    var imgs = [], pending = imgUrls.length, failed = false;
    imgUrls.forEach(function (url, i) {
      var img = new Image();
      img.onload = function () {
        imgs[i] = img;
        if (--pending === 0 && !failed) finish();
      };
      img.onerror = function () {
        if (failed) return;
        failed = true;
        setStatus("Could not open the png \"" + font.pages[i] + "\" (looked in " + (pngPaths[i] || url) + "). Put it in the same folder as the .fnt.", true);
      };
      img.src = url;
    });

    function finish() {
      var warn = [];
      var W = font.common.scaleW, H = font.common.scaleH;
      imgs.forEach(function (im, i) {
        if (W && H && (im.naturalWidth !== W || im.naturalHeight !== H)) {
          warn.push("\"" + font.pages[i] + "\" is " + im.naturalWidth + "×" + im.naturalHeight + " but the .fnt expects " + W + "×" + H + " — glyphs may be misaligned.");
        }
      });
      if (font.common.packed) warn.push("Fonts with packed channels (packed=1) are not supported; glyphs may look wrong.");
      state.font = font; state.imgs = imgs; state.fntPath = fntPath; state.pngPaths = pngPaths;
      state.overrides = {}; state.selected = null;
      $("fontName").textContent = font.info.face || "(unnamed)";
      $("fontName").classList.remove("muted");
      $("lineHeight").value = font.common.lineHeight;
      $("compName").value = font.info.face || "FNT Text";
      $("btnCreate").disabled = !(inCEP && pngPaths[0]);
      if (settings) applySettings(settings);
      setStatus(warn.join(" ") || (inCEP ? "" : "Browser mode: preview only (cannot create comps)."), warn.length > 0);
      render();
    }
  }

  // Reads a .fnt from disk (CEP) and loads the pages next to it.
  function loadFntFile(path, settings) {
    var f = window.cep.fs.readFile(path, window.cep.encoding.UTF8);
    if (f.err) return setStatus("Could not read the .fnt (code " + f.err + "): " + path, true);
    var font;
    try { font = FntParser.parse(f.data); } catch (e) { return setStatus(e.message, true); }
    var dir = dirname(path);
    var pngPaths = font.pages.map(function (file) { return joinPath(dir, file); });
    for (var i = 0; i < pngPaths.length; i++) {
      if (window.cep.fs.stat(pngPaths[i]).err !== 0) {
        return setStatus("Missing png \"" + font.pages[i] + "\" next to the .fnt (" + dir + ").", true);
      }
    }
    setFont(font, path, pngPaths.map(fileUrl), pngPaths, settings);
    return true;
  }

  function openFnt() {
    if (inCEP) {
      var r = window.cep.fs.showOpenDialogEx(false, false, "Choose a .fnt file", "", ["fnt"]);
      if (r.err || !r.data || !r.data.length) return;
      unlink();
      loadFntFile(r.data[0]);
    } else {
      $("browserFiles").click();
    }
  }

  // browser development fallback: pick the .fnt + pngs together
  var inp = document.createElement("input");
  inp.type = "file"; inp.multiple = true; inp.accept = ".fnt,.png"; inp.id = "browserFiles"; inp.hidden = true;
  document.body.appendChild(inp);
  inp.addEventListener("change", function () {
    var files = Array.prototype.slice.call(inp.files);
    var fnt = files.filter(function (f) { return /\.fnt$/i.test(f.name); })[0];
    if (!fnt) return setStatus("Select the .fnt and the .png files together.", true);
    fnt.text().then(function (t) {
      var font;
      try { font = FntParser.parse(t); } catch (e) { return setStatus(e.message, true); }
      var urls = [];
      for (var i = 0; i < font.pages.length; i++) {
        var png = files.filter(function (f) { return f.name === font.pages[i]; })[0];
        if (!png) return setStatus("Missing png \"" + font.pages[i] + "\" in the selection.", true);
        urls.push(URL.createObjectURL(png));
      }
      setFont(font, fnt.name, urls, urls.map(function () { return null; }));
    });
  });

  // ---------- layout + drawing ----------
  function currentOptions() {
    var ov = {};
    Object.keys(state.overrides).forEach(function (k) {
      var o = state.overrides[k];
      ov[k] = { kern: o.kern, dy: o.dy, scale: (o.scale == null ? 100 : o.scale) / 100, rot: o.rot };
    });
    return {
      scale: (parseFloat($("scale").value) || 100) / 100,
      tracking: parseFloat($("tracking").value) || 0,
      lineHeight: parseFloat($("lineHeight").value) || undefined,
      overrides: ov
    };
  }

  function render() {
    if (!state.font) { draw(); return; }
    state.layout = FntLayout.layoutText(state.font, $("text").value, currentOptions());
    var m = state.layout.missing;
    $("missing").hidden = !m.length;
    $("missing").textContent = m.length ? "No glyph in this font for: " + m.map(function (c) { return "“" + c + "”"; }).join(" ") : "";
    draw();
  }

  function drawBackground(w, h) {
    var bg = $("bg").value;
    if (bg === "checker") {
      var s = 10 * dpr();
      for (var y = 0; y < h; y += s) for (var x = 0; x < w; x += s) {
        ctx.fillStyle = ((x / s + y / s) & 1) ? "#2b2b2b" : "#383838";
        ctx.fillRect(x, y, s, s);
      }
    } else {
      ctx.fillStyle = bg === "dark" ? "#111" : "#eee";
      ctx.fillRect(0, 0, w, h);
    }
  }
  function dpr() { return window.devicePixelRatio || 1; }

  function draw() {
    var cssW = canvas.clientWidth || 380;
    var L = state.layout;
    var aspect = L && L.width > 0 ? L.height / L.width : 0.4;
    var cssH = Math.max(120, Math.min(360, Math.round(cssW * aspect) + 40));
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr());
    canvas.height = Math.round(cssH * dpr());
    drawBackground(canvas.width, canvas.height);
    if (!L || !state.imgs.length) return;

    var m = 14 * dpr();
    var k = Math.min((canvas.width - 2 * m) / Math.max(1, L.width), (canvas.height - 2 * m) / Math.max(1, L.height), 2);
    var ox = (canvas.width - L.width * k) / 2, oy = (canvas.height - L.height * k) / 2;
    state.view = { k: k, ox: ox, oy: oy };

    L.glyphs.forEach(function (g) {
      ctx.save();
      ctx.translate(ox + (g.x + g.w / 2) * k, oy + (g.y + g.h / 2) * k);
      ctx.rotate(g.rot * Math.PI / 180);
      ctx.drawImage(state.imgs[g.page], g.sx, g.sy, g.sw, g.sh, -g.w * k / 2, -g.h * k / 2, g.w * k, g.h * k);
      if (g.index === state.selected) {
        ctx.strokeStyle = "#2d9cff"; ctx.lineWidth = 1.5 * dpr();
        ctx.strokeRect(-g.w * k / 2, -g.h * k / 2, g.w * k, g.h * k);
      }
      ctx.restore();
    });
  }

  // ---------- selection and per-letter adjustments ----------
  function ovFor(i) { return state.overrides[i] || (state.overrides[i] = {}); }

  function showLetterPanel() {
    var g = state.layout && state.layout.glyphs.filter(function (x) { return x.index === state.selected; })[0];
    $("letterPanel").hidden = !g;
    if (!g) return;
    var o = state.overrides[g.index] || {};
    $("selChar").textContent = "“" + g.char + "” #" + (g.index + 1);
    $("ovKern").value = o.kern || 0;
    $("ovDy").value = o.dy || 0;
    $("ovScale").value = o.scale == null ? 100 : o.scale;
    $("ovRot").value = o.rot || 0;
  }

  function select(i) { state.selected = i; showLetterPanel(); draw(); canvas.focus(); }

  canvas.addEventListener("mousedown", function (e) {
    if (!state.layout || !state.view) return;
    var r = canvas.getBoundingClientRect();
    var px = (e.clientX - r.left) * dpr(), py = (e.clientY - r.top) * dpr();
    var v = state.view, hit = null;
    state.layout.glyphs.forEach(function (g) {
      var x = v.ox + g.x * v.k, y = v.oy + g.y * v.k;
      if (px >= x && px <= x + g.w * v.k && py >= y && py <= y + g.h * v.k) hit = g.index;
    });
    select(hit);
  });

  canvas.addEventListener("keydown", function (e) {
    if (state.selected == null) return;
    var o = ovFor(state.selected), step = e.shiftKey ? 5 : 1, used = true;
    if (e.key === "ArrowLeft") o.kern = (o.kern || 0) - step;
    else if (e.key === "ArrowRight") o.kern = (o.kern || 0) + step;
    else if (e.key === "ArrowUp") o.dy = (o.dy || 0) - step;
    else if (e.key === "ArrowDown") o.dy = (o.dy || 0) + step;
    else used = false;
    if (used) { e.preventDefault(); render(); showLetterPanel(); }
  });

  [["ovKern", "kern"], ["ovDy", "dy"], ["ovScale", "scale"], ["ovRot", "rot"]].forEach(function (p) {
    $(p[0]).addEventListener("input", function () {
      if (state.selected == null) return;
      ovFor(state.selected)[p[1]] = parseFloat($(p[0]).value) || 0;
      render();
    });
  });
  $("btnResetLetter").addEventListener("click", function () {
    if (state.selected == null) return;
    delete state.overrides[state.selected];
    render(); showLetterPanel();
  });

  // ---------- create composition ----------
  function setStatus(msg, isError) {
    $("status").textContent = msg || "";
    $("status").className = "small " + (isError ? "warn" : "muted");
  }

  // Settings stored in the Controller layer's comment (so the comp can be edited again).
  function currentSettings() {
    return {
      fnt: state.fntPath, text: $("text").value, overrides: state.overrides,
      padding: parseFloat($("padding").value) || 0, fps: parseFloat($("fps").value) || 30,
      duration: parseFloat($("duration").value) || 5, bg: $("bg").value
    };
  }

  function applySettings(m) {
    $("text").value = m.text || "";
    state.overrides = m.overrides || {};
    if (m.padding != null) $("padding").value = m.padding;
    if (m.fps != null) $("fps").value = m.fps;
    if (m.duration != null) $("duration").value = m.duration;
    if (m.bg) $("bg").value = m.bg;
    if (m.size != null) $("scale").value = m.size;
    if (m.tracking != null) $("tracking").value = m.tracking;
    if (m.lineHeight != null) $("lineHeight").value = m.lineHeight;
    render();
  }

  function createComp(forceNew) {
    if (!state.layout || !state.layout.glyphs.length) return setStatus("Nothing to create: type some text using glyphs the font has.", true);
    var L = state.layout, opts = currentOptions();
    // Base layout (scale 1, tracking 0, line height 0): the AE expressions add the slider differences.
    var base = FntLayout.layoutText(state.font, $("text").value,
      { scale: 1, tracking: 0, lineHeight: 0, overrides: opts.overrides });
    var Nw = Math.max.apply(null, base.counts);
    var glyphs = L.glyphs.map(function (g, i) {
      var b = base.glyphs[i];
      return {
        char: g.char, index: g.index, page: g.page, sx: g.sx, sy: g.sy, sw: g.sw, sh: g.sh,
        relx: g.x + g.w / 2 - L.width / 2, rely: g.y + g.h / 2 - L.height / 2,
        scale: g.scale, rot: g.rot,
        P: b.x + b.w / 2, Q: b.y + b.h / 2, n: g.n, line: g.line
      };
    });
    var linked = !forceNew && state.linked;
    var settings = currentSettings();
    settings.size = opts.scale * 100; settings.tracking = opts.tracking; settings.lineHeight = opts.lineHeight;
    var payload = {
      pngs: state.pngPaths, compId: linked ? state.linked.id : null,
      compName: $("compName").value || "FNT Text",
      fps: settings.fps, duration: settings.duration, padding: settings.padding,
      width: L.width, height: L.height,
      s0: opts.scale, t0: opts.tracking, lh0: opts.lineHeight || state.font.common.lineHeight,
      Wb: base.width, Nw: Nw, lines: L.lines,
      meta: JSON.stringify(settings),
      glyphs: glyphs
    };
    var call = "fntReaderBuildComp(" + JSON.stringify(JSON.stringify(payload)) + ")";
    setStatus(linked ? "Updating…" : "Creating…");
    host.evalScript(call, function (res) {
      if (res.indexOf("OK:") === 0) {
        link({ id: parseInt(res.slice(3), 10), name: linked ? state.linked.name : payload.compName });
        setStatus(linked ? "Composition updated." : "Composition created.");
      } else setStatus(res, true);
    });
  }

  // ---------- linking to an existing composition ----------
  function link(c) {
    state.linked = c;
    $("link").textContent = "Linked composition: " + c.name;
    $("link").classList.remove("muted");
    $("btnUnlink").hidden = $("btnCreateNew").hidden = false;
    $("nameRow").hidden = true;
    $("btnCreate").textContent = "Update composition";
  }

  function unlink() {
    state.linked = null;
    $("link").textContent = "Composition: new";
    $("link").classList.add("muted");
    $("btnUnlink").hidden = $("btnCreateNew").hidden = true;
    $("nameRow").hidden = false;
    $("btnCreate").textContent = "Create composition";
  }

  function loadFromActive() {
    if (!inCEP) return setStatus("Only available inside After Effects.", true);
    host.evalScript("fntReaderReadActive()", function (res) {
      if (res.indexOf("OK|") !== 0) return setStatus(res, true);
      var p = res.split("|");
      var meta;
      try { meta = JSON.parse(p.slice(6).join("|")); } catch (e) { return setStatus("Could not read this composition's settings.", true); }
      // current Controller slider values take priority over the saved ones
      meta.size = parseFloat(p[3]); meta.tracking = parseFloat(p[4]); meta.lineHeight = parseFloat(p[5]);
      var fntPath = meta.fnt;
      if (window.cep.fs.stat(fntPath).err !== 0) {
        // file moved/renamed: ask the user to locate it
        var r = window.cep.fs.showOpenDialogEx(false, false, "Could not find " + fntPath + " — locate the .fnt", "", ["fnt"]);
        if (r.err || !r.data || !r.data.length) return setStatus("Original .fnt not found: " + fntPath, true);
        fntPath = r.data[0];
      }
      if (loadFntFile(fntPath, meta)) link({ id: parseInt(p[1], 10), name: p[2] });
    });
  }

  // ---------- wiring ----------
  $("btnOpen").addEventListener("click", openFnt);
  $("btnCreate").addEventListener("click", function () { createComp(false); });
  $("btnCreateNew").addEventListener("click", function () { createComp(true); });
  $("btnLoad").addEventListener("click", loadFromActive);
  $("btnUnlink").addEventListener("click", function () { unlink(); setStatus(""); });
  ["text", "scale", "tracking", "lineHeight"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("bg").addEventListener("change", draw);
  window.addEventListener("resize", draw);
  draw();
})();
