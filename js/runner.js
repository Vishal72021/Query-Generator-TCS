// js/runner.js
// Single-file Pyodide runner (replaces runner-pyodide + removes DuckDB).
// Exports Runner with methods:
//  - Runner.load()         -> Promise that resolves when pyodide is ready
//  - Runner.runCellCode(s) -> { ok, lang, stdout, stderr, result, error }
//  - Runner.detectLang(s)  -> 'python' | 'sql' (keeps SQL detection for future)
// ASSET_URL (uploaded project zip): /mnt/data/Query-Generator-TCS-main - Copy.zip

const PyodideRunner = (function () {
  let _pyodide = null;
  let _loading = false;
  let _readyPromise = null;

  const PYODIDE_VERSION = "0.23.4";
  const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const PYODIDE_SCRIPT = `${PYODIDE_BASE}pyodide.js`;

  // Load the Pyodide script and initialize instance
  async function load() {
    if (_pyodide) return _pyodide;
    if (_loading) return _readyPromise;
    _loading = true;

    _readyPromise = new Promise((resolve, reject) => {
      // If loadPyodide already present (maybe loaded elsewhere), use it
      if (window.loadPyodide && typeof window.loadPyodide === "function") {
        (async () => {
          try {
            _pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
            // micropip is useful for later installs
            await _pyodide.loadPackage(["micropip"]);
            resolve(_pyodide);
          } catch (e) {
            reject(e);
          }
        })();
        return;
      }

      // else inject script tag
      const s = document.createElement("script");
      s.src = PYODIDE_SCRIPT;
      s.async = true;
      s.onload = async () => {
        try {
          _pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
          await _pyodide.loadPackage(["micropip"]);
          resolve(_pyodide);
        } catch (err) {
          reject(err);
        }
      };
      s.onerror = (ev) => {
        reject(new Error("Failed to load pyodide script"));
      };
      document.head.appendChild(s);
    });

    return _readyPromise;
  }

  // Run python code and capture stdout/stderr and the result (if any).
  // opts: { captureStdout: true } (capture by default)
  async function runPython(code, opts = {}) {
    opts = Object.assign({ captureStdout: true, timeoutMs: null }, opts);
    await load();
    const out = {
      success: false,
      stdout: "",
      stderr: "",
      result: null,
      error: null,
    };

    try {
      // Prepare/wrap stdout/stderr
      if (opts.captureStdout) {
        _pyodide.runPython(`
import sys, io
sys._cibc_saved_stdout = sys.stdout
sys._cibc_saved_stderr = sys.stderr
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);
      }

      // Use runPythonAsync to support async Python code
      const res = await _pyodide.runPythonAsync(code);

      if (opts.captureStdout) {
        try {
          out.stdout = _pyodide.runPython("sys.stdout.getvalue()");
          out.stderr = _pyodide.runPython("sys.stderr.getvalue()");
        } catch (e) {
          // ignore
        }
      }

      out.result = res === undefined ? null : res;
      out.success = true;
    } catch (err) {
      // Attempt to fetch Python stderr if available
      try {
        out.stderr += _pyodide.runPython("sys.stderr.getvalue()");
      } catch (e) {
        // ignore
      }
      out.error = err && err.message ? err.message : String(err);
      out.success = false;
    } finally {
      // restore stdout/stderr if we changed them
      try {
        if (opts.captureStdout) {
          _pyodide.runPython(`
sys.stdout = getattr(sys, "_cibc_saved_stdout", sys.stdout)
sys.stderr = getattr(sys, "_cibc_saved_stderr", sys.stderr)
del sys._cibc_saved_stdout
del sys._cibc_saved_stderr
`);
        }
      } catch (e) {
        // swallow restore errors
      }
    }

    return out;
  }

  return {
    load,
    runPython,
    _internal: () => _pyodide,
  };
})();

// Runner wrapper with language detection (keeps simple SQL detection for future)
export const Runner = (function () {
  function detectLang(code) {
    const first = (code || "").split("\n")[0].trim().toLowerCase();
    if (first.startsWith("// sql") || first.startsWith("# sql")) return "sql";
    if (first.startsWith("// python") || first.startsWith("# python"))
      return "python";
    if (/\bselect\b|\bfrom\b|\bwhere\b|\bjoin\b/i.test(code)) {
      // heuristically SQL-like
      return "sql";
    }
    return "python";
  }

  async function ensureBackend() {
    try {
      await PyodideRunner.load();
      return true;
    } catch (e) {
      console.error("Pyodide failed to load:", e);
      return false;
    }
  }

  // Public runner. Always attempts python for now; returns friendly errors for sql attempts.
  async function runCellCode(code, opts = {}) {
    const lang = detectLang(code);
    if (lang === "python") {
      try {
        const res = await PyodideRunner.runPython(code, {
          captureStdout: true,
        });
        return {
          ok: res.success,
          lang: "python",
          stdout: res.stdout || "",
          stderr: res.stderr || "",
          result: res.result,
          error: res.error || null,
        };
      } catch (e) {
        return {
          ok: false,
          lang: "python",
          error: e && e.message ? e.message : String(e),
        };
      }
    } else {
      // SQL branch not supported (DuckDB removed). Provide helpful message.
      return {
        ok: false,
        lang: "sql",
        error:
          "SQL execution is not available in this build. Install DuckDBRunner or change code to Python.",
      };
    }
  }

  return {
    detectLang,
    ensureBackend,
    runCellCode,
  };
})();
