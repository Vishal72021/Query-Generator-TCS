// js/enhancements.js
// Adds floating toolbars, tooltips, drag wiggle animations.

console.log("enhancements.js loaded");

function makeToolbarNode() {
  const wrap = document.createElement("div");
  wrap.className = "cell-toolbar";

  wrap.innerHTML = `
    <button class="tool" data-action="run" title="Run">▶</button>
    <button class="tool" data-action="edit" title="Edit">✎</button>
    <button class="tool" data-action="up" title="Move up">↑</button>
    <button class="tool" data-action="down" title="Move down">↓</button>
    <button class="tool" data-action="delete" title="Delete">🗑</button>
  `;
  return wrap;
}

function initToolbars() {
  document.querySelectorAll(".cell").forEach((cell) => {
    if (cell.querySelector(".cell-toolbar")) return;
    const tb = makeToolbarNode();
    cell.appendChild(tb);

    cell.addEventListener("mouseenter", () => tb.classList.add("visible"));
    cell.addEventListener("mouseleave", () => tb.classList.remove("visible"));
  });
}

// Drag-handle wiggle
function initDragHandles() {
  document.querySelectorAll(".drag-handle").forEach((h) => {
    h.addEventListener("pointerdown", () => {
      h.classList.add("dragging");
    });

    window.addEventListener("pointerup", () => {
      h.classList.remove("dragging");
    });
  });
}

// Auto-init
function start() {
  initToolbars();
  initDragHandles();

  // observe DOM mutations (new cells)
  const mo = new MutationObserver(() => {
    initToolbars();
    initDragHandles();
  });

  mo.observe(document.getElementById("cells"), { childList: true });
}

document.addEventListener("DOMContentLoaded", start);
