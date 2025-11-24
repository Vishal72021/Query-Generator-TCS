// js/wiring.js (revised)
// Integrates Runner, dragdrop, AI, DeltaSim, UI wiring
import { Runner } from "./runner.js";
import { initDragReorder } from "./dragdrop.js";

const STORAGE_KEY = "cibc_notebook_v2";
const cellsRoot = document.getElementById("cells");

// start loading backends but do not block UI
async function ensureRunners() {
  try {
    await Runner.ensureBackend();
  } catch (e) {
    console.warn("Runner backend failed to init:", e);
  }
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

// run a single cell, show states, return result
async function runCell(cell) {
  if (!cell) return;
  const code = getCodeText(cell);

  // runner status container
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
        // SQL not supported in this runner build; show helpful message
        setOutput(
          cell,
          `<pre style="color: #b81d1d">${escapeHtml(
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
  const cells = Array.from(cellsRoot.querySelectorAll(".cell"));
  for (const c of cells) {
    // await each run to keep order and avoid concurrency issues in pyodide
    // you can parallelize later if you want
    await runCell(c);
  }
}

// wire events
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
    } else if (act === "run") {
      await runCell(cell);
    } else if (act === "edit") {
      const code = cell.querySelector(".code");
      if (!code) return;
      const editable = code.getAttribute("contenteditable") === "true";
      code.setAttribute("contenteditable", editable ? "false" : "true");
      if (!editable) {
        code.focus();
        // place caret at end
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
    } else if (act === "up") {
      const prev = cell.previousElementSibling;
      if (prev) cellsRoot.insertBefore(cell, prev);
      save();
    } else if (act === "down") {
      const next = cell.nextElementSibling;
      // move after the next element (i.e. swap)
      if (next) {
        cellsRoot.insertBefore(next, cell);
        save();
      }
    } else if (act === "ai-explain") {
      // AI module might be optional; guard with try/catch
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
  });

  // add-between buttons (buttons between cells) if you use them
  document.addEventListener("click", (ev) => {
    const addBetween = ev.target.closest(".add-between-btn");
    if (!addBetween) return;
    // find the separator container and insert after it
    const sep = addBetween.closest(".add-between");
    if (!sep) return;
    const newCell = createCellDOM("# New cell\n", true);
    sep.parentNode.insertBefore(newCell, sep.nextSibling);
    save();
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
    const cells = Array.from(cellsRoot.querySelectorAll(".cell")).map((c) =>
      getCodeText(c)
    );
    const win = window.open();
    win.document.write(
      `<pre>${escapeHtml(JSON.stringify(cells, null, 2))}</pre>`
    );
    win.document.close();
  });

  // Update to Delta -> demo: upsert to delta sim (guard with DeltaSim)
  document
    .getElementById("updateDeltaBtn")
    ?.addEventListener("click", async () => {
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
  window.addEventListener("cells:reordered", () => save());
}

// autosave / load
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

// Theme toggler & sign-in UI wiring
(function uiOverrides() {
  // Sign-in / sign-out single button in nav-right
  function setSignedInUI(signedIn) {
    document.body.classList.toggle("signed-in", !!signedIn);
    const navRight = document.querySelector(".nav-right");
    if (!navRight) return;
    // find existing btn or create one
    let btn = navRight.querySelector(".btn.signin, .btn.signup");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "btn signup";
      // insert before toggler if present, otherwise append
      const togg = document.getElementById("themeToggle");
      if (togg) navRight.insertBefore(btn, togg);
      else navRight.appendChild(btn);
    }
    // clear previous handlers
    btn.onclick = null;

    if (signedIn) {
      btn.textContent = "Sign out";
      btn.classList.remove("signup");
      btn.classList.add("signin");
      btn.onclick = (e) => {
        e.preventDefault();
        try {
          localStorage.removeItem("cibc_jira_key");
          sessionStorage.removeItem("cibc_api_token");
        } catch (ee) {}
        setSignedInUI(false);
        if (window.CIBC_UI?.toast)
          window.CIBC_UI.toast("Signed out", { type: "info" });
      };
      // reflect slight style change if you want (body.signed-in in CSS)
      document.body.classList.add("signed-in");
    } else {
      btn.textContent = "Sign in";
      btn.classList.remove("signin");
      btn.classList.add("signup");
      btn.onclick = (e) => {
        e.preventDefault();
        const modal = document.getElementById("signupModal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.setAttribute("aria-hidden", "false");
          const u = modal.querySelector("#modalUser");
          if (u) setTimeout(() => u.focus(), 40);
        }
      };
      document.body.classList.remove("signed-in");
    }
  }

  // initialize from persisted demo state
  const signed =
    !!localStorage.getItem("cibc_jira_key") ||
    !!sessionStorage.getItem("cibc_api_token");
  setSignedInUI(signed);
})();

// init
document.addEventListener("DOMContentLoaded", async () => {
  // start loading runner in background (do not block UI)
  ensureRunners();
  // load saved cells (if any)
  load();
  // wire UI (handlers)
  wireUI();
  // init drag/drop
  try {
    initDragReorder("#cells");
  } catch (e) {
    console.warn("dragdrop init failed", e);
  }
});
