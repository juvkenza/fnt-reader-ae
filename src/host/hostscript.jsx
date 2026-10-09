// Bridge to After Effects (ExtendScript). Called by the panel through evalScript.
// This is the only part of the project that talks to AE — a future UXP panel
// would replace this file.

var FNT_META = "FNTR1:";   // prefix of the Controller layer comment (stores the settings)
var FNT_GLYPH = "FNTG:";   // prefix of each letter layer comment (stores the glyph index)

function fntReaderPing() {
    return "AE " + app.version;
}

function fntFindFootage(path) {
    var proj = app.project;
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (it instanceof FootageItem && it.mainSource instanceof FileSource &&
            it.mainSource.file && it.mainSource.file.fsName === File(path).fsName) {
            return it;
        }
    }
    return null;
}

function fntFindController(comp) {
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (l.comment && l.comment.indexOf(FNT_META) === 0) return l;
    }
    return null;
}

// Only writes if the property has no keyframes (never clobbers the user's animation).
function fntSetIfFree(prop, value) {
    if (prop.numKeys === 0) { prop.setValue(value); return true; }
    return false;
}

function fntSetExpr(prop, expr) {
    if (prop.numKeys === 0) { prop.expression = expr; prop.expressionEnabled = true; }
}

// ---------- Controller layer (centered guide shape layer) ----------
function fntSlider(ctrl, name, value) {
    var fx = ctrl.property("ADBE Effect Parade");
    var e = fx.property(name);
    if (!e) {
        e = fx.addProperty("ADBE Slider Control");
        e.name = name;
        e.property(1).setValue(value);
    } else if (e.property(1).numKeys === 0 && !e.property(1).expressionEnabled) {
        e.property(1).setValue(value);
    }
}

function fntMakeController(comp, data, cx, cy) {
    var ctrl = comp.layers.addShape();
    ctrl.name = "Controller";
    var grp = ctrl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    grp.name = "Controller";
    var inner = grp.property("ADBE Vectors Group");
    inner.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([100, 100]);
    var stroke = inner.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue([0.6, 0.1, 0.1]);
    stroke.property("ADBE Vector Stroke Width").setValue(2);
    var dashes = stroke.property("ADBE Vector Stroke Dashes");
    dashes.addProperty("ADBE Vector Stroke Dash 1").setValue(3);
    dashes.addProperty("ADBE Vector Stroke Gap 1").setValue(3);
    ctrl.label = 1;           // red
    ctrl.guideLayer = true;   // does not render
    var t = ctrl.property("ADBE Transform Group");
    t.property("ADBE Anchor Point").setValue([0, 0]);   // shape centered on the origin...
    t.property("ADBE Position").setValue([cx, cy]);     // ...and origin at the comp center
    return ctrl;
}

// ---------- letter layers ----------
function fntSetMask(layer, g) {
    var parade = layer.property("ADBE Mask Parade");
    var mask = parade.numProperties > 0 ? parade.property(1) : parade.addProperty("ADBE Mask Atom");
    var shape = new Shape();
    shape.vertices = [[g.sx, g.sy], [g.sx + g.sw, g.sy], [g.sx + g.sw, g.sy + g.sh], [g.sx, g.sy + g.sh]];
    shape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.closed = true;
    mask.property("ADBE Mask Shape").setValue(shape);
}

// The expressions add, to the static value/keyframes, the difference caused by the sliders
// (so letters can still be animated by hand).
function fntPosExpr(g, d) {
    var px = g.P - d.Wb / 2;
    var nn = g.n - (d.Nw - 1) / 2;
    var ll = g.line - d.lines / 2;
    return "var c = thisLayer.parent; var r = value;\n" +
        "if (c) {\n" +
        "  var s = c.effect(\"Size\")(1) / 100, t = c.effect(\"Tracking\")(1), lh = c.effect(\"Line Height\")(1);\n" +
        "  var dx = s * (" + px + " + t * " + nn + ") - " + d.s0 + " * (" + px + " + " + d.t0 + " * " + nn + ");\n" +
        "  var dy = s * (" + g.Q + " + " + ll + " * lh) - " + d.s0 + " * (" + g.Q + " + " + ll + " * " + d.lh0 + ");\n" +
        "  r = value + [dx, dy];\n" +
        "}\nr";
}

function fntScaleExpr(d) {
    return "var c = thisLayer.parent; var r = value;\n" +
        "if (c) { var k = c.effect(\"Size\")(1) / 100 / " + d.s0 + "; r = [value[0] * k, value[1] * k]; }\nr";
}

function fntApplyGlyph(layer, g, d) {
    layer.name = g.char + " " + (g.index + 1);
    fntSetMask(layer, g);
    var t = layer.property("ADBE Transform Group");
    fntSetIfFree(t.property("ADBE Anchor Point"), [g.sx + g.sw / 2, g.sy + g.sh / 2]);

    var pos = t.property("ADBE Position");
    if (fntSetIfFree(pos, [g.relx, g.rely])) fntSetExpr(pos, fntPosExpr(g, d));

    var sc = t.property("ADBE Scale");
    if (fntSetIfFree(sc, [g.scale * 100, g.scale * 100])) fntSetExpr(sc, fntScaleExpr(d));

    fntSetIfFree(t.property("ADBE Rotate Z"), g.rot || 0);
}

// payload (JSON string): see panel/js/main.js -> createComp()
function fntReaderBuildComp(json) {
    var data;
    try {
        data = eval("(" + json + ")");
    } catch (e) {
        return "ERROR: invalid payload (" + e.toString() + ")";
    }

    for (var pi = 0; pi < data.pngs.length; pi++) {
        if (!(new File(data.pngs[pi])).exists) return "ERROR: png not found: " + data.pngs[pi];
    }

    app.beginUndoGroup(data.compId ? "FNT Reader: update composition" : "FNT Reader: create composition");
    try {
        // one footage item per atlas page (reuses already imported ones)
        var footages = [];
        for (pi = 0; pi < data.pngs.length; pi++) {
            var ft = fntFindFootage(data.pngs[pi]);
            if (!ft) {
                var opts = new ImportOptions(new File(data.pngs[pi]));
                opts.importAs = ImportAsType.FOOTAGE;
                ft = app.project.importFile(opts);
            }
            footages.push(ft);
        }

        var comp;
        var updating = !!data.compId;
        if (updating) {
            comp = app.project.itemByID(data.compId);
            if (!(comp instanceof CompItem)) return "ERROR: the linked composition no longer exists. Use 'Create new composition'.";
        } else {
            var pad0 = data.padding || 0;
            var cw = Math.max(4, Math.min(30000, Math.ceil(data.width + pad0 * 2)));
            var ch = Math.max(4, Math.min(30000, Math.ceil(data.height + pad0 * 2)));
            comp = app.project.items.addComp(data.compName, cw, ch, 1, data.duration || 5, data.fps || 30);
        }
        // The comp always fits the text + margin.
        var pad = data.padding || 0;
        var nw = Math.max(4, Math.min(30000, Math.ceil(data.width + pad * 2)));
        var nh = Math.max(4, Math.min(30000, Math.ceil(data.height + pad * 2)));
        var dw = nw - comp.width, dh = nh - comp.height;
        if (dw !== 0 || dh !== 0) comp.width = nw, comp.height = nh;
        var cx = comp.width / 2, cy = comp.height / 2;

        // Controller
        var ctrl = fntFindController(comp);
        if (!ctrl) ctrl = fntMakeController(comp, data, cx, cy);
        else if (dw !== 0 || dh !== 0) {
            // keep the Controller at the same position relative to the comp center
            var cp = ctrl.property("ADBE Transform Group").property("ADBE Position");
            if (cp.numKeys === 0) cp.setValue([cp.value[0] + dw / 2, cp.value[1] + dh / 2]);
        }
        fntSlider(ctrl, "Size", data.s0 * 100);
        fntSlider(ctrl, "Tracking", data.t0);
        fntSlider(ctrl, "Line Height", data.lh0);
        ctrl.comment = FNT_META + data.meta;

        // existing letter layers (by index)
        var existing = {};
        var i;
        for (i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l.comment && l.comment.indexOf(FNT_GLYPH) === 0) existing[l.comment.substr(FNT_GLYPH.length)] = l;
        }

        var keep = {};
        // last to first: the 1st letter ends up on top of the stack
        for (i = data.glyphs.length - 1; i >= 0; i--) {
            var g = data.glyphs[i];
            var layer = existing[g.index];
            var isNew = !layer;
            if (isNew) {
                layer = comp.layers.add(footages[g.page || 0]);
                layer.comment = FNT_GLYPH + g.index;
            }
            keep[g.index] = true;
            if (!isNew && layer.source !== footages[g.page || 0]) layer.replaceSource(footages[g.page || 0], false);
            if (isNew) layer.parent = ctrl;   // before the values: AE compensates the position when the parent changes
            fntApplyGlyph(layer, g, data);
        }

        // letters that no longer exist in the text
        for (var k in existing) {
            if (!keep[k]) existing[k].remove();
        }
        if (!updating) ctrl.moveToBeginning();

        comp.openInViewer();
        return "OK:" + comp.id;
    } catch (e) {
        return "ERROR: " + e.toString() + " (line " + e.line + ")";
    } finally {
        app.endUndoGroup();
    }
}

// Reads the settings of the active composition (created by FNT Reader).
// Reply: OK|id|name|size|tracking|lineHeight|meta(json)
function fntReaderReadActive() {
    var c = app.project.activeItem;
    if (!(c instanceof CompItem)) return "ERROR: open/select a composition.";
    var ctrl = fntFindController(c);
    if (!ctrl) return "ERROR: this composition was not created by FNT Reader.";
    var fx = ctrl.property("ADBE Effect Parade");
    function v(n) { var p = fx.property(n); return p ? p.property(1).value : ""; }
    return "OK|" + c.id + "|" + c.name + "|" + v("Size") + "|" + v("Tracking") + "|" + v("Line Height") + "|" + ctrl.comment.substr(FNT_META.length);
}
