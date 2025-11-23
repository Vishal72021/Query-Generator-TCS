// js/runner-pyodide.js
// Loads Pyodide (WASM) and exposes high-level runPython(code) that returns { success, stdout, stderr, result }.
// CDN used: https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js
// Defensive: if loading fails, runPython throws meaningful error.

export const PyodideRunner = (function () {
  let pyodide = null;
  let loading = false;
  let readyPromise = null;

  async function load() {
    if (pyodide) return pyodide;
    if (loading) return readyPromise;
    loading = true;
    // load pyodide script
    readyPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
      s.onload = async () => {
        try {
          // global loadPyodide
          pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
          });
          // install micropip for package installs
          await pyodide.loadPackage(["micropip"]);
          resolve(pyodide);
        } catch (err) {
          reject(err);
        }
      };
      s.onerror = (e) =>
        reject(new Error("Failed to load pyodide: " + e.message));
      document.head.appendChild(s);
    });
    return readyPromise;
  }

  async function runPython(code, opts = {}) {
    // opts: { captureStdout: true/false }
    await load();
    const out = { success: false, stdout: "", stderr: "", result: null };
    // route stdout/stderr
    const stdoutBuf = [];
    const stderrBuf = [];
    try {
      // attach Python sys.stdout/stderr wrappers
      pyodide.runPython(`
import sys, io
sys._saved_stdout = sys.stdout
sys._saved_stderr = sys.stderr
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);
      let res = await pyodide.runPythonAsync(code);
      // get buffers
      out.stdout = pyodide.runPython("sys.stdout.getvalue()");
      out.stderr = pyodide.runPython("sys.stderr.getvalue()");
      out.result = res === undefined ? null : res;
      out.success = true;
    } catch (err) {
      // fetch stderr if possible
      try {
        out.stderr += pyodide.runPython("sys.stderr.getvalue()");
      } catch (e) {}
      out.stderr += err && err.message ? "\n" + err.message : String(err);
      out.success = false;
    } finally {
      // restore
      try {
        pyodide.runPython(
          "sys.stdout = sys._saved_stdout; sys.stderr = sys._saved_stderr"
        );
      } catch (e) {}
    }
    return out;
  }

  return { load, runPython };
})();
