/* "Scrubby" number fields, like After Effects:
   drag right/left to increase/decrease; Shift = steps x10; Ctrl = steps x0.1;
   click without dragging to type a value. Attributes: data-step, data-min, data-max. */
(function () {
  function decimalsOf(step) {
    var s = String(step), i = s.indexOf(".");
    return i < 0 ? 0 : s.length - i - 1;
  }

  function attach(inp) {
    var step = parseFloat(inp.dataset.step) || 1;
    var min = inp.dataset.min !== undefined ? parseFloat(inp.dataset.min) : -Infinity;
    var max = inp.dataset.max !== undefined ? parseFloat(inp.dataset.max) : Infinity;
    var dec = decimalsOf(step) + 1; // room for Ctrl fine adjustment
    var drag = null;

    function fire() { inp.dispatchEvent(new Event("input", { bubbles: true })); }
    function clamp(v) { return Math.min(max, Math.max(min, v)); }
    function fmt(v) { return String(parseFloat(v.toFixed(dec))); }

    inp.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || document.activeElement === inp) return; // already editing: default behavior
      e.preventDefault();
      inp.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, moved: false, acc: parseFloat(inp.value) || 0 };
    });

    inp.addEventListener("pointermove", function (e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 3) return;
      if (!drag.moved) { drag.moved = true; drag.last = drag.x; document.body.style.cursor = "ew-resize"; }
      var dx = e.clientX - drag.last;
      drag.last = e.clientX;
      var mult = e.shiftKey ? 10 : e.ctrlKey ? 0.1 : 1;
      drag.acc = clamp(drag.acc + dx * step * mult);
      inp.value = fmt(drag.acc);
      fire();
    });

    function end(e) {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      document.body.style.cursor = "";
      try { inp.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!moved) { inp.focus(); inp.select(); }
    }
    inp.addEventListener("pointerup", end);
    inp.addEventListener("pointercancel", end);

    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === "Escape") inp.blur();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        var mult = e.shiftKey ? 10 : e.ctrlKey ? 0.1 : 1;
        var v = (parseFloat(inp.value) || 0) + (e.key === "ArrowUp" ? 1 : -1) * step * mult;
        inp.value = fmt(clamp(v));
        fire();
      }
    });
    inp.addEventListener("change", function () {
      var v = parseFloat(String(inp.value).replace(",", "."));
      inp.value = isNaN(v) ? "0" : fmt(clamp(v));
      fire();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("input.scrub"), attach);
})();
