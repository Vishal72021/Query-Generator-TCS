// js/wiring.js (clean revised)
// Integrates Runner, dragdrop, AI, DeltaSim, UI wiring

import { Runner } from "./runner.js";
import { initDragReorder } from "./dragdrop.js";

const STORAGE_KEY = "cibc_notebook_v2";
const cellsRoot = document.getElementById("cells");

// Start loading backends but do not block UI
async function ensureRunners() {
  try {
    await Runner.ensureBackend();
  } catch (e) {
    console.warn("Runner backend failed to init:", e);
  }
}

// ---------- Empty state helper: "Add first cell" ----------

function ensureEmptyStateAddButton() {
  if (!cellsRoot) return;

  const cellCount = cellsRoot.querySelectorAll(".cell").length;
  let emptyState = document.getElementById("cells-empty-state");

  if (cellCount === 0) {
    if (!emptyState) {
      emptyState = document.createElement("div");
      emptyState.id = "cells-empty-state";
      emptyState.style.display = "flex";
      emptyState.style.justifyContent = "center";
      emptyState.style.padding = "24px";

      emptyState.innerHTML = `
        <button class="btn primary" id="addFirstCellBtn">
          ＋ Add first cell
        </button>
      `;

      cellsRoot.appendChild(emptyState);

      const addFirstBtn = emptyState.querySelector("#addFirstCellBtn");
      addFirstBtn.addEventListener("click", () => {
        const newCell = createCellDOM("# New cell\n");
        cellsRoot.innerHTML = "";
        cellsRoot.appendChild(newCell);
        save();
        ensureEmptyStateAddButton();
      });
    }
  } else {
    if (emptyState) emptyState.remove();
  }
}

// ---------- Cell creation / helpers ----------

function createCellDOM(codeText = "# New cell\n", opts = {}) {
  const article = document.createElement("article");
  article.className = "cell";
  article.tabIndex = -1;
  article.innerHTML = `
    <div class="reorder-handle" title="Drag to reorder">☰</div>
    <div class="cell-toolbar" role="toolbar" aria-label="Cell actions">
      <button class="tool" data-action="clone" title="Clone">📄</button>
      <button class="tool" data-action="run" title="Run">▶</button>
      <button class="tool" data-action="edit" title="Edit">✎</button>
      <button class="tool" data-action="up" title="Move up">↑</button>
      <button class="tool" data-action="down" title="Move down">↓</button>
      <button class="tool" data-action="delete" title="Delete">🗑</button>
      <button class="tool" data-action="ai-explain" title="Explain">💡</button>
      <button class="tool" data-action="ai-fix" title="Fix">🔧</button>
    </div>
    <div class="content">
      <div class="code" contenteditable="false" spellcheck="false">${escapeHtml(
        codeText
      )}</div>
      <div class="cell-output" aria-live="polite"></div>
      <div style="margin-top:8px">
        <button class="btn add-cell-btn">＋ Add cell</button>
      </div>
    </div>
  `;
  return article;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getCodeText(cell) {
  const el = cell.querySelector(".code");
  return el ? el.innerText : "";
}

function setOutput(cell, html) {
  const o = cell.querySelector(".cell-output");
  if (o) o.innerHTML = html;
}

// ---------- Runner integration ----------

// run a single cell, show states, return result
async function runCell(cell) {
  if (!cell) return;
  const code = getCodeText(cell);

  const runnerResEl = (function () {
    let el = cell.querySelector(".run-status");
    if (!el) {
      el = document.createElement("div");
      el.className = "run-status";
      el.style.marginTop = "8px";
      el.style.fontSize = "13px";
      el.style.color = "var(--muted)";
      cell.querySelector(".content").appendChild(el);
    }
    return el;
  })();

  runnerResEl.textContent = "Running…";
  cell.classList.add("running");
  try {
    const res = await Runner.runCellCode(code);
    if (res.ok) {
      if (res.lang === "python") {
        const outText = res.stdout || (res.result ? String(res.result) : "");
        setOutput(cell, `<pre>${escapeHtml(outText)}</pre>`);
      } else {
        // SQL not supported in this build
        setOutput(
          cell,
          `<pre style="color:#b81d1d">${escapeHtml(
            res.error ||
              "SQL execution is not configured. This build runs Python only."
          )}</pre>`
        );
      }
      runnerResEl.textContent = "Done";
    } else {
      setOutput(
        cell,
        `<pre style="color:#c21a1a">${escapeHtml(
          res.error || res.stderr || "Error"
        )}</pre>`
      );
      runnerResEl.textContent = "Error";
    }
  } catch (err) {
    setOutput(
      cell,
      `<pre style="color:#c21a1a">${escapeHtml(
        err.message || String(err)
      )}</pre>`
    );
    runnerResEl.textContent = "Error";
  } finally {
    cell.classList.remove("running");
    setTimeout(() => {
      runnerResEl?.remove();
    }, 1800);
  }
}

// run all sequentially
async function runAll() {
  if (!cellsRoot) return;
  const cells = Array.from(cellsRoot.querySelectorAll(".cell"));
  for (const c of cells) {
    await runCell(c);
  }
}

// ---------- Wiring / events ----------

function wireUI() {
  // toolbar click handling (delegated)
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest(".tool");
    if (!t) return;
    const cell = t.closest(".cell");
    const act = t.dataset.action;
    if (!cell || !act) return;

    if (act === "clone") {
      const copy = createCellDOM(getCodeText(cell));
      cell.parentNode.insertBefore(copy, cell.nextSibling);
      save();
      ensureEmptyStateAddButton();
    } else if (act === "run") {
      await runCell(cell);
    } else if (act === "edit") {
      const code = cell.querySelector(".code");
      if (!code) return;
      const editable = code.getAttribute("contenteditable") === "true";
      code.setAttribute("contenteditable", editable ? "false" : "true");
      if (!editable) {
        code.focus();
        const range = document.createRange();
        range.selectNodeContents(code);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      save();
    } else if (act === "delete") {
      cell.remove();
      save();
      ensureEmptyStateAddButton();
    } else if (act === "up") {
      const prev = cell.previousElementSibling;
      if (prev) cellsRoot.insertBefore(cell, prev);
      save();
    } else if (act === "down") {
      const next = cell.nextElementSibling;
      if (next) {
        cellsRoot.insertBefore(next, cell);
        save();
      }
    } else if (act === "ai-explain") {
      try {
        if (window.AI && typeof AI.aiExplain === "function") {
          const code = getCodeText(cell);
          const r = await AI.aiExplain(code);
          setOutput(cell, `<pre>${escapeHtml(r.ok ? r.text : r.error)}</pre>`);
        } else {
          setOutput(cell, `<pre>AI explain not available.</pre>`);
        }
      } catch (e) {
        setOutput(
          cell,
          `<pre style="color:#c21a1a">${escapeHtml(String(e))}</pre>`
        );
      }
    } else if (act === "ai-fix") {
      try {
        if (window.AI && typeof AI.aiFix === "function") {
          const code = getCodeText(cell);
          const r = await AI.aiFix(code);
          if (r.ok) {
            setOutput(cell, `<pre>${escapeHtml(r.text)}</pre>`);
          } else {
            setOutput(
              cell,
              `<pre style="color:#c21a1a">${escapeHtml(r.error)}</pre>`
            );
          }
        } else {
          setOutput(cell, `<pre>AI fix not available.</pre>`);
        }
      } catch (e) {
        setOutput(
          cell,
          `<pre style="color:#c21a1a">${escapeHtml(String(e))}</pre>`
        );
      }
    }
  });

  // Add cell button (inside a cell)
  document.addEventListener("click", (ev) => {
    const add = ev.target.closest(".add-cell-btn");
    if (!add) return;
    const cell = add.closest(".cell");
    const newCell = createCellDOM("# New cell\n", true);
    cell.parentNode.insertBefore(newCell, cell.nextSibling);
    save();
    ensureEmptyStateAddButton();
  });

  // add-between buttons (if you use them)
  document.addEventListener("click", (ev) => {
    const addBetween = ev.target.closest(".add-between-btn");
    if (!addBetween) return;
    const sep = addBetween.closest(".add-between");
    if (!sep) return;
    const newCell = createCellDOM("# New cell\n", true);
    sep.parentNode.insertBefore(newCell, sep.nextSibling);
    save();
    ensureEmptyStateAddButton();
  });

  // auto-save when cell content changes
  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.matches && ev.target.matches(".code"))
      saveDebounced();
  });

  // run-all button
  const runAllBtn = document.getElementById("runAllBtn");
  runAllBtn?.addEventListener("click", async () => {
    runAllBtn.disabled = true;
    try {
      await runAll();
    } finally {
      runAllBtn.disabled = false;
    }
  });

  // run-as-new button (open new window with code list)
  document.getElementById("runAsNewBtn")?.addEventListener("click", () => {
    if (!cellsRoot) return;
    const cells = Array.from(cellsRoot.querySelectorAll(".cell")).map((c) =>
      getCodeText(c)
    );
    const win = window.open();
    win.document.write(
      `<pre>${escapeHtml(JSON.stringify(cells, null, 2))}</pre>`
    );
    win.document.close();
  });

  // Update to Delta -> demo
  document
    .getElementById("updateDeltaBtn")
    ?.addEventListener("click", async () => {
      try {
        if (!cellsRoot) return;
        const last = Array.from(cellsRoot.querySelectorAll(".cell")).pop();
        const out = last?.querySelector(".cell-output")?.innerText || "";
        let rows = [];
        try {
          rows = JSON.parse(out);
        } catch (e) {}
        if (!Array.isArray(rows) || rows.length === 0) {
          alert(
            "Delta update demo requires the last cell to output JSON array rows. This is a simulated demo."
          );
          return;
        }
        if (window.DeltaSim && typeof DeltaSim.upsert === "function") {
          await DeltaSim.upsert("notebook_output", rows, Object.keys(rows[0]));
          alert("Delta (sim) updated — versioned in browser.");
        } else {
          alert("DeltaSim not available in this environment.");
        }
      } catch (err) {
        alert("Delta update failed: " + (err.message || err));
      }
    });

  // listen to reorder event to save
  window.addEventListener("cells:reordered", () => {
    save();
    ensureEmptyStateAddButton();
  });
}

// ---------- autosave / load ----------

function save() {
  if (!cellsRoot) return;
  const data = Array.from(cellsRoot.querySelectorAll(".cell")).map((c) => ({
    code: getCodeText(c),
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("save failed", e);
  }
}

function load() {
  if (!cellsRoot) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // nothing saved -> keep existing (already in HTML)
    ensureEmptyStateAddButton();
    return;
  }
  try {
    const arr = JSON.parse(raw);
    cellsRoot.innerHTML = "";
    arr.forEach((item) => cellsRoot.appendChild(createCellDOM(item.code)));
  } catch (err) {
    console.warn("load failed", err);
  }
  ensureEmptyStateAddButton();
}

let _saveTimeout = null;
function saveDebounced() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(save, 700);
}

// ---------- init ----------

document.addEventListener("DOMContentLoaded", async () => {
  ensureRunners();
  load();
  wireUI();
  ensureEmptyStateAddButton();
  try {
    initDragReorder("#cells");
  } catch (e) {
    console.warn("dragdrop init failed", e);
  }
});
