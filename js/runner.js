// js/runner.js
// Unified runner: uses PyodideRunner and DuckDBRunner (above).
// Exports runCellCode(text) which returns { ok, lang, output, table (if sql), error }

import { PyodideRunner } from "./runner-pyodide.js";
import { DuckDBRunner } from "./runner-duckdb.js";

export const Runner = (function () {
  // heuristic to detect language
  function detectLang(code) {
    const first = (code || "").split("\n")[0].trim().toLowerCase();
    if (first.startsWith("// sql") || first.startsWith("# sql")) return "sql";
    if (first.startsWith("// python") || first.startsWith("# python"))
      return "python";
    // look for SQL keywords
    if (/\bselect\b|\bfrom\b|\bwhere\b|\bjoin\b/i.test(code)) {
      // could be python with SQL string but default to sql
      return "sql";
    }
    // default to python
    return "python";
  }

  async function ensureBackends() {
    // start both in parallel but don't await both if not needed
    const p = PyodideRunner.load().catch((e) => {
      console.warn("pyodide load failed", e);
    });
    const q = DuckDBRunner.load().catch((e) => {
      console.warn("duckdb load failed", e);
    });
    await Promise.allSettled([p, q]);
  }

  async function runCellCode(code) {
    const lang = detectLang(code);
    if (lang === "python") {
      try {
        const res = await PyodideRunner.runPython(code, {
          captureStdout: true,
        });
        return {
          ok: res.success,
          lang: "python",
          stdout: res.stdout,
          stderr: res.stderr,
          result: res.result,
        };
      } catch (err) {
        return { ok: false, lang: "python", error: err.message || String(err) };
      }
    } else {
      try {
        const res = await DuckDBRunner.runSQL(code);
        if (res.success) return { ok: true, lang: "sql", table: res.result };
        return { ok: false, lang: "sql", error: res.error || "SQL error" };
      } catch (err) {
        return {
          ok: false,
          lang: "sql",
          error: err && err.message ? err.message : String(err),
        };
      }
    }
  }

  return { ensureBackends, runCellCode, detectLang };
})();
