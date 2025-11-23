// js/import-export.js
// Notebook import / export wiring (file picker + server/local-file quick import).
// Usage: include <script type="module" src="js/import-export.js"></script>
// Relies on DOM structure from index.html: #importBtn, #exportBtn, #cells, .add-between insertion pattern
// Uses window.CIBC_UI.toast for notifications if available.

// ----- EDIT ONLY IF YOU WANT A DIFFERENT PATH -----
// This points to the uploaded project archive you mentioned earlier.
// Your environment will convert this path to a URL if needed.
const UPLOADED_ARCHIVE_URL = "/mnt/data/Query-Generator-TCS-main - Copy.zip";

// ----- Helpers -----
const PAGE = "body";
const qs = (sel) => document.querySelector(`${PAGE} ${sel}`);
const qsa = (sel) => Array.from(document.querySelectorAll(`${PAGE} ${sel}`));

function nowISO() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toast(msg, opts = {}) {
  if (window.CIBC_UI && typeof window.CIBC_UI.toast === "function") {
    window.CIBC_UI.toast(msg, opts);
  } else {
    // fallback
    console.info("Toast:", msg);
  }
}

// read current notebook from DOM and return a serializable object
function serializeNotebook() {
  const cells = qsa("#cells .cell").map((cell) => {
    const codeEl = cell.querySelector(".code");
    return {
      content: codeEl ? codeEl.textContent : "",
      editable: codeEl
        ? codeEl.getAttribute("contenteditable") === "true"
        : false,
      // future: add metadata (language, outputs, tags, id)
    };
  });

  // optional meta
  const meta = {
    exportedAt: new Date().toISOString(),
    app: "CIBC Query Generator (demo)",
  };

  return { meta, cells };
}

// create a cell DOM node from data object
function createCellNode(data = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = "cell";
  wrapper.tabIndex = -1;
  wrapper.setAttribute("role", "listitem");

  // drag handle
  const drag = document.createElement("div");
  drag.className = "drag-handle";
  drag.setAttribute("aria-hidden", "true");
  drag.textContent = "≡";

  // content
  const content = document.createElement("div");
  content.className = "content";

  const code = document.createElement("div");
  code.className = "code code-10";
  code.setAttribute("contenteditable", String(Boolean(data.editable)));
  code.setAttribute("spellcheck", "false");
  code.textContent = data.content || "";

  content.appendChild(code);

  wrapper.appendChild(drag);
  wrapper.appendChild(content);

  return wrapper;
}

// remove all existing cells safely
function clearCells() {
  const root = qs("#cells");
  if (!root) return;
  // remove all children
  while (root.firstChild) root.removeChild(root.firstChild);
}

// insert a cell at index (0-based). if index omitted or >= count, append to end.
function insertCellAt(data, index) {
  const root = qs("#cells");
  if (!root) return;
  const node = createCellNode(data);
  const children = Array.from(root.children);
  if (typeof index !== "number" || index >= children.length) {
    // append with add-between button before if needed
    root.appendChild(node);
    appendAddBetweenAfter(node);
  } else {
    // insert node before children[index]
    const ref = children[index];
    // if the ref is an add-between element (separator), insert before it
    root.insertBefore(node, ref);
    // ensure an add-between control exists before the next cell
    appendAddBetweenAfter(node);
  }
  // re-init wiring for the newly added node (if wiring provides initializers)
  // Example: if you have window.initCell or window.rebindToolbar
  if (window.CIBCInputs && typeof window.CIBCInputs.init === "function") {
    try {
      window.CIBCInputs.init();
    } catch (e) {
      /* ignore */
    }
  }
  if (window.CIBC && typeof window.CIBC.rebind === "function") {
    try {
      window.CIBC.rebind();
    } catch (e) {
      /* ignore */
    }
  }
  return node;
}

// builds an add-between element after the given node (if not already present)
function appendAddBetweenAfter(cellNode) {
  if (!cellNode || !cellNode.parentElement) return;
  // look for next sibling; if it's an add-between, leave it; otherwise, insert one
  const next = cellNode.nextElementSibling;
  if (next && next.classList.contains("add-between")) return;

  const sep = document.createElement("div");
  sep.className = "add-between";
  sep.setAttribute("role", "separator");
  const btn = document.createElement("button");
  btn.className = "btn add-between-btn";
  btn.type = "button";
  btn.title = "Add cell";
  btn.textContent = "＋ Add cell";
  sep.appendChild(btn);
  // insert after cellNode
  if (cellNode.nextSibling)
    cellNode.parentElement.insertBefore(sep, cellNode.nextSibling);
  else cellNode.parentElement.appendChild(sep);

  // wire local listener
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    // insert a fresh cell after the previous cell (which is cellNode)
    const newData = { content: "# New cell\n", editable: true };
    // insert before the next cell (i.e., after the previous)
    // find the index
    const root = qs("#cells");
    const nodes = Array.from(root.children).filter(
      (ch) => ch.classList && ch.classList.contains("cell")
    );
    const idx = nodes.indexOf(cellNode);
    insertCellAt(newData, idx + 1);
    toast("Cell added", { duration: 1000, type: "success" });
  });
}

// ensure final add button exists and wires it
function wireFinalAddButton() {
  const finalBtn = qs("#addFinalBtn");
  if (!finalBtn) return;
  finalBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    const data = { content: "# New cell\n", editable: true };
    insertCellAt(data);
    toast("Cell added", { duration: 1000, type: "success" });
  });
}

// Export: serialize notebook and trigger download
function doExport() {
  try {
    const payload = serializeNotebook();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cibc-notebook-${nowISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Notebook exported", { duration: 1400, type: "success" });
  } catch (err) {
    console.error("Export failed", err);
    toast("Export failed", { duration: 1800, type: "error" });
  }
}

// Import from a JSON string/object
function importFromObject(obj) {
  if (!obj || !Array.isArray(obj.cells)) {
    toast("Invalid notebook format", { duration: 1800, type: "error" });
    return;
  }
  clearCells();
  const root = qs("#cells");
  // insert each cell and an add-between after each
  obj.cells.forEach((cellData, idx) => {
    const node = createCellNode(cellData);
    root.appendChild(node);
    appendAddBetweenAfter(node);
  });
  // ensure there's a final add control (we keep #addFinalBtn in the DOM)
  wireFinalAddButton();
  toast("Notebook imported", { duration: 1400, type: "success" });
}

// Import via file picker
function importViaFilePicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", (ev) => {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target.result));
        importFromObject(parsed);
      } catch (err) {
        console.error("Import parse error", err);
        toast("Failed to parse JSON file", { duration: 1800, type: "error" });
      }
    };
    reader.readAsText(f);
  });
  input.click();
}

// Import from server/local uploaded path (UPLOADED_ARCHIVE_URL -> expects JSON in plain text)
// NOTE: your environment will typically transform the path into a URL we can fetch. Keep CORS in mind.
async function importFromUrl(url) {
  try {
    toast("Downloading import file…", { duration: 1000 });
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network response not ok: " + res.status);
    // try to parse as JSON — if the uploaded file is a zip, you'll need server-side extraction
    const text = await res.text();
    // if it's JSON:
    try {
      const parsed = JSON.parse(text);
      importFromObject(parsed);
      return;
    } catch (jsonErr) {
      // not JSON — show helpful message
      console.warn("Not JSON; server file content length:", text.length);
      toast(
        "Imported file is not JSON. If it is a zip, extract server-side before importing.",
        { duration: 3000, type: "error" }
      );
    }
  } catch (err) {
    console.error("Import from URL failed", err);
    toast("Import failed", { duration: 1800, type: "error" });
  }
}

// Initialize wiring: wire buttons on the page
function initImportExport() {
  const importBtn = qs("#importBtn");
  const exportBtn = qs("#exportBtn");

  if (exportBtn && !exportBtn.__wired) {
    exportBtn.__wired = true;
    exportBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      doExport();
    });
  }

  if (importBtn && !importBtn.__wired) {
    importBtn.__wired = true;
    importBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      // open a tiny menu: prefer file picker; also offer quick import from uploaded archive
      // Since we avoid UI complexity here, we'll show a simple confirm: if user confirms, fetch the uploaded path
      const useRemote = confirm(
        "Import from a local JSON file? (Cancel to import demo uploaded file)"
      );
      if (useRemote) {
        importViaFilePicker();
      } else {
        // attempt to fetch the uploaded archive path (note: often it's a zip; server extraction may be needed)
        importFromUrl(UPLOADED_ARCHIVE_URL);
      }
    });
  }

  // wire final add button if present
  wireFinalAddButton();
}

// auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initImportExport);
} else initImportExport();

export { doExport, importFromUrl, importViaFilePicker, importFromObject };
