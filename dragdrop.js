// js/dragdrop.js
// Pointer-based reorder for #cells container. Adds smooth placeholder insertion and mirror element.

export function initDragReorder(containerSelector = "#cells") {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  if (container.__dd_inited) return;
  container.__dd_inited = true;

  let dragging = null;
  let mirror = null;
  let placeholder = null;
  let startY = 0;
  let offset = 0;

  function createPlaceholder(h) {
    const p = document.createElement("div");
    p.className = "cell-placeholder";
    p.style.height = h + "px";
    p.style.border = "2px dashed rgba(0,0,0,0.06)";
    p.style.borderRadius = "10px";
    p.style.margin = "0";
    p.style.transition = "height 160ms ease";
    return p;
  }

  container.addEventListener("pointerdown", (ev) => {
    const handle = ev.target.closest(".reorder-handle, .drag-handle");
    if (!handle) return;
    const cell = handle.closest(".cell");
    if (!cell) return;
    ev.preventDefault();
    dragging = cell;
    startY = ev.clientY;
    const rect = cell.getBoundingClientRect();
    offset = ev.clientY - rect.top;

    // clone mirror
    mirror = cell.cloneNode(true);
    mirror.style.position = "fixed";
    mirror.style.left = rect.left + "px";
    mirror.style.top = rect.top + "px";
    mirror.style.width = rect.width + "px";
    mirror.style.zIndex = 9999;
    mirror.style.boxShadow = "0 18px 40px rgba(2,6,23,0.12)";
    mirror.style.pointerEvents = "none";
    mirror.style.transform = "scale(1.02)";
    document.body.appendChild(mirror);

    placeholder = createPlaceholder(rect.height);
    cell.parentNode.insertBefore(placeholder, cell.nextSibling);
    cell.style.visibility = "hidden";

    function onMove(e) {
      if (!dragging) return;
      mirror.style.top = e.clientY - offset + "px";
      // find insertion point
      const others = Array.from(container.querySelectorAll(".cell")).filter(
        (c) => c !== dragging
      );
      let insertBefore = null;
      for (const o of others) {
        const r = o.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          insertBefore = o;
          break;
        }
      }
      if (insertBefore) {
        if (placeholder.nextSibling !== insertBefore)
          container.insertBefore(placeholder, insertBefore);
      } else {
        container.appendChild(placeholder);
      }
    }

    function onUp(e) {
      if (!dragging) return;
      // place dragging at placeholder
      container.insertBefore(dragging, placeholder);
      dragging.style.visibility = "";
      // animate mirror to new position then remove
      const finalRect = dragging.getBoundingClientRect();
      mirror.style.transition = "all 220ms cubic-bezier(.2,.9,.25,1)";
      mirror.style.left = finalRect.left + "px";
      mirror.style.top = finalRect.top + "px";
      setTimeout(() => {
        mirror.remove();
        mirror = null;
        if (placeholder) placeholder.remove();
        placeholder = null;
        // save order event
        window.dispatchEvent(new CustomEvent("cells:reordered"));
      }, 240);

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragging = null;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
  });
}
