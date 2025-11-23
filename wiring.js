// js/wiring.js (revised)
// Integrates Runner, dragdrop, AI, DeltaSim, UI wiring
import { Runner } from "./runner.js";
import { initDragReorder } from "./dragdrop.js";
import * as AI from "./ai.js";
import { DeltaSim } from "./delta-sim.js";

const STORAGE_KEY = "cibc_notebook_v2";
const cellsRoot = document.getElementById("cells");

async function ensureRunners() {
  // start loading backends but do not block UI
  Runner.ensureBackends().catch((e) =>
    console.warn("runners failed to init", e)
  );
}

// Create a new cell element (more full-featured than earlier)
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
      <div style="margin-top:8px"><button class="btn add-cell-btn">＋ Add cell</button></div>
    </div>
  `;
  return article;
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getCodeText(cell) {
  return cell.querySelector(".code").innerText;
}
function setOutput(cell, html) {
  const o = cell.querySelector(".cell-output");
  if (o) o.innerHTML = html;
}

// run a single cell, show states, return result
async function runCell(cell) {
  const code = getCodeText(cell);
  const runnerResEl = ((sel) => {
    let el = cell.querySelector(".run-status");
    if (!el) {
      el = document.createElement("div");
      el.className = "run-status";
      el.style.marginTop = "8px";
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
        setOutput(
          cell,
          `<pre>${escapeHtml(res.stdout || String(res.result || ""))}</pre>`
        );
      } else {
        // SQL -> show table
        const tbl = res.table;
        if (tbl && tbl.columns && tbl.data) {
          const cols = tbl.columns
            .map((c) => `<th>${escapeHtml(c)}</th>`)
            .join("");
          const rows = (tbl.data || [])
            .map(
              (r) =>
                `<tr>${r
                  .map(
                    (c) => `<td>${escapeHtml(String(c == null ? "" : c))}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("");
          setOutput(
            cell,
            `<div class="table-wrap"><table class="result-table"><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table></div>`
          );
        } else {
          setOutput(
            cell,
            `<pre>${escapeHtml(
              JSON.stringify(res.table || res, null, 2)
            )}</pre>`
          );
        }
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
    setTimeout(() => runnerResEl.remove(), 1800);
  }
}

// run all sequentially
async function runAll() {
  const cells = Array.from(cellsRoot.querySelectorAll(".cell"));
  for (const c of cells) {
    await runCell(c);
  }
}

// wire events
function wireUI() {
  // add toolbar handling
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest(".tool");
    if (!t) return;
    const cell = t.closest(".cell");
    const act = t.dataset.action;
    if (act === "clone") {
      const copy = createCellDOM(getCodeText(cell));
      cell.parentNode.insertBefore(copy, cell.nextSibling);
      save();
    } else if (act === "run") {
      await runCell(cell);
    } else if (act === "edit") {
      const code = cell.querySelector(".code");
      const editable = code.getAttribute("contenteditable") === "true";
      code.setAttribute("contenteditable", editable ? "false" : "true");
      if (!editable) code.focus();
      save();
    } else if (act === "delete") {
      cell.remove();
      save();
    } else if (act === "up") {
      const prev = cell.previousElementSibling;
      if (prev) cellsRoot.insertBefore(cell, prev);
      save();
    } else if (act === "down") {
      const next = cell.nextElementSibling;
      if (next) cellsRoot.insertBefore(next, cell);
      save();
    } else if (act === "ai-explain") {
      const code = getCodeText(cell);
      const r = await AI.aiExplain(code);
      setOutput(cell, `<pre>${escapeHtml(r.ok ? r.text : r.error)}</pre>`);
    } else if (act === "ai-fix") {
      const code = getCodeText(cell);
      const r = await AI.aiFix(code);
      if (r.ok) {
        // show and optionally replace (ask user)
        setOutput(cell, `<pre>${escapeHtml(r.text)}</pre>`);
      } else
        setOutput(
          cell,
          `<pre style="color:#c21a1a">${escapeHtml(r.error)}</pre>`
        );
    }
  });

  // Add cell button
  document.addEventListener("click", (ev) => {
    const add = ev.target.closest(".add-cell-btn");
    if (!add) return;
    const cell = add.closest(".cell");
    const newCell = createCellDOM("# New cell\n", true);
    cell.parentNode.insertBefore(newCell, cell.nextSibling);
    save();
  });

  // auto-save when cell content changes
  document.addEventListener("input", (ev) => {
    if (ev.target.matches(".code")) saveDebounced();
  });

  // run-all button
  const runAllBtn = document.getElementById("runAllBtn");
  runAllBtn?.addEventListener("click", async () => {
    runAllBtn.disabled = true;
    await runAll();
    runAllBtn.disabled = false;
  });

  // run-as-new button
  document.getElementById("runAsNewBtn")?.addEventListener("click", () => {
    const cells = Array.from(cellsRoot.querySelectorAll(".cell")).map((c) =>
      getCodeText(c)
    );
    const win = window.open();
    win.document.write(
      `<pre>${escapeHtml(JSON.stringify(cells, null, 2))}</pre>`
    );
    win.document.close();
  });

  // Update to Delta -> demo: upsert to delta sim
  document
    .getElementById("updateDeltaBtn")
    ?.addEventListener("click", async () => {
      // collect last cell output if table-like
      // For demo, create a table called "notebook_output" with rows extracted from last cell if JSON
      try {
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
        await DeltaSim.upsert("notebook_output", rows, Object.keys(rows[0]));
        alert("Delta (sim) updated — versioned in browser.");
      } catch (err) {
        alert("Delta update failed: " + (err.message || err));
      }
    });

  // listen to reorder event to save
  window.addEventListener("cells:reordered", () => save());
}

// autosave / load
function save() {
  const data = Array.from(cellsRoot.querySelectorAll(".cell")).map((c) => ({
    code: getCodeText(c),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // nothing saved -> keep existing (already in HTML)
    return;
  }
  try {
    const arr = JSON.parse(raw);
    cellsRoot.innerHTML = "";
    arr.forEach((item) => cellsRoot.appendChild(createCellDOM(item.code)));
  } catch (err) {
    console.warn("load failed", err);
  }
}

let _saveTimeout = null;
function saveDebounced() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(save, 700);
}

// init
document.addEventListener("DOMContentLoaded", async () => {
  await Runner.ensureBackends();
  load();
  wireUI();
  initDragReorder("#cells"); // from dragdrop.js
});
