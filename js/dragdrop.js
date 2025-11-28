// js/dragdrop.js
// Drag & drop reorder for .cell elements using the .reorder-handle
// Works with wiring.js: initDragReorder("#cells") and fires "cells:reordered" on window.

export function initDragReorder(rootSelector = "#cells") {
  const container = document.querySelector(rootSelector);
  if (!container) {
    console.warn("initDragReorder: container not found for", rootSelector);
    return;
  }

  let draggingCell = null;
  let placeholder = null;
  let startY = 0;
  let offsetY = 0;
  let lastIndex = -1;
  let cleanupFns = [];

  function onHandleMouseDown(e) {
    const handle = e.target.closest(".reorder-handle");
    if (!handle) return;

    const cell = handle.closest(".cell");
    if (!cell || !container.contains(cell)) return;

    e.preventDefault();

    draggingCell = cell;
    const rect = cell.getBoundingClientRect();
    startY = e.clientY;
    offsetY = e.clientY - rect.top;

    // Create placeholder with same height to keep layout stable
    placeholder = document.createElement("div");
    placeholder.className = "cell-placeholder";
    placeholder.style.height = rect.height + "px";

    // Insert placeholder in place of the cell
    container.insertBefore(placeholder, cell);
    cell.classList.add("dragging");
    cell.style.position = "absolute";
    cell.style.left = rect.left + "px";
    cell.style.width = rect.width + "px";
    cell.style.zIndex = 999;
    moveCell(e.clientY);

    // prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const mm = (ev) => onMouseMove(ev);
    const mu = (ev) => onMouseUp(ev);

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);

    cleanupFns.push(() => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    });
  }

  function moveCell(clientY) {
    if (!draggingCell) return;
    const y = clientY - offsetY;
    draggingCell.style.top = y + "px";

    // Figure out where placeholder should go
    const cells = Array.from(container.querySelectorAll(".cell")).filter(
      (c) => c !== draggingCell
    );

    const centerY = clientY;

    let targetIndex = -1;
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (centerY < mid) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      // place at end
      container.appendChild(placeholder);
      lastIndex = cells.length;
    } else {
      container.insertBefore(placeholder, cells[targetIndex]);
      lastIndex = targetIndex;
    }
  }

  function onMouseMove(e) {
    if (!draggingCell) return;
    e.preventDefault();
    moveCell(e.clientY);

    // auto-scroll if near viewport edge
    const edge = 60;
    if (e.clientY < edge) {
      window.scrollBy(0, -12);
    } else if (e.clientY > window.innerHeight - edge) {
      window.scrollBy(0, 12);
    }
  }

  function onMouseUp(e) {
    if (!draggingCell) return;

    // restore styles
    draggingCell.classList.remove("dragging");
    draggingCell.style.position = "";
    draggingCell.style.top = "";
    draggingCell.style.left = "";
    draggingCell.style.width = "";
    draggingCell.style.zIndex = "";

    // put cell where placeholder is
    if (placeholder && placeholder.parentNode === container) {
      container.insertBefore(draggingCell, placeholder);
      placeholder.remove();
    }
    placeholder = null;

    // restore selection + cursor
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    // cleanup listeners
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    draggingCell = null;

    // notify others (wiring.js listens to this)
    window.dispatchEvent(
      new CustomEvent("cells:reordered", {
        detail: { root: rootSelector, index: lastIndex },
      })
    );
  }

  // Attach mousedown on handles (delegated)
  container.addEventListener("mousedown", (e) => {
    const handle = e.target.closest(".reorder-handle");
    if (!handle) return;
    onHandleMouseDown(e);
  });
}
