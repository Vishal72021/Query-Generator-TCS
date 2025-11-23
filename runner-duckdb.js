// js/runner-duckdb.js
// Robust DuckDB loader with CDN → local fallback → mock fallback
// Usage: await DuckDBRunner.load(); await DuckDBRunner.runSQL('SELECT 1');

export const DuckDBRunner = (function () {
  let _ready = null;
  let _dbWorkerInstance = null;
  let _conn = null;
  let _mode = null; // "cdn", "local", "mock"

  // LOCAL bundle URLs to try (serve these from your server)
  // Put worker and wasm files under /static/duckdb/ (example)
  const LOCAL_BUNDLES = [
    {
      name: "local-main",
      worker: "/static/duckdb/duckdb-wasm-main.worker.js",
    },
    {
      name: "local-fallback",
      worker: "/static/duckdb/duckdb-wasm-worker.js",
    },
  ];

  // Attempt to load duckdb-wasm from CDN first, multiple bundles
  async function tryCdnBundles() {
    if (!window.duckdb_wasm) {
      // load entry script
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdn.jsdelivr.net/npm/duckdb-wasm@1.11.0/dist/duckdb-wasm.js";
        s.onload = resolve;
        s.onerror = () =>
          reject(new Error("Failed loading duckdb-wasm entry script from CDN"));
        document.head.appendChild(s);
      });
    }
    if (!window.duckdb_wasm)
      throw new Error("duckdb_wasm global missing after CDN script load");
    const duckdb_wasm = window.duckdb_wasm;
    const bundles = duckdb_wasm.getJsDelivrBundles
      ? duckdb_wasm.getJsDelivrBundles()
      : [];
    if (!bundles || bundles.length === 0)
      throw new Error("No CDN bundles available from duckdb_wasm");
    for (const bundle of bundles) {
      try {
        const workerUrl = bundle.mainWorker || bundle.worker;
        if (!workerUrl) continue;
        const logger = new duckdb_wasm.ConsoleLogger();
        const inst = await duckdb_wasm.init(
          duckdb_wasm.instantiateWorker(workerUrl),
          logger
        );
        const dbInst = new inst.AsyncDuckDB();
        await dbInst.instantiate();
        const conn = await dbInst.connect();
        _dbWorkerInstance = dbInst;
        _conn = conn;
        _mode = "cdn";
        console.log(
          "duckdb: initialized from CDN bundle",
          bundle.name || bundle.mainWorker
        );
        return { db: _dbWorkerInstance, conn: _conn };
      } catch (err) {
        console.warn(
          "duckdb: CDN bundle failed:",
          err && err.message ? err.message : err
        );
        // try next
      }
    }
    throw new Error("All CDN bundles failed to instantiate");
  }

  // Try local-hosted bundles (you must host the worker files and .wasm on your server)
  async function tryLocalBundles() {
    if (!window.duckdb_wasm) {
      // try to load local copy of duckdb-wasm entry script if available
      const localEntry = "/static/duckdb/duckdb-wasm.js";
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = localEntry;
          s.onload = resolve;
          s.onerror = () =>
            reject(new Error("Failed loading local duckdb-wasm entry script"));
          document.head.appendChild(s);
        });
      } catch (err) {
        // ignore — we may still have CDN global or not
      }
    }
    const duckdb_wasm = window.duckdb_wasm;
    if (!duckdb_wasm) {
      // If local entry not present, try using the CDN library already loaded (if available)
      console.warn(
        "duckdb: local loader will still use duckdb_wasm global if present"
      );
    }
    const ducklib = window.duckdb_wasm;
    if (!ducklib)
      throw new Error("duckdb_wasm global not present for local instantiation");
    for (const bundle of LOCAL_BUNDLES) {
      try {
        const workerUrl = bundle.worker;
        if (!workerUrl) continue;
        const logger = new ducklib.ConsoleLogger();
        const inst = await ducklib.init(
          ducklib.instantiateWorker(workerUrl),
          logger
        );
        const dbInst = new inst.AsyncDuckDB();
        await dbInst.instantiate();
        const conn = await dbInst.connect();
        _dbWorkerInstance = dbInst;
        _conn = conn;
        _mode = "local";
        console.log("duckdb: initialized from local bundle", workerUrl);
        return { db: _dbWorkerInstance, conn: _conn };
      } catch (err) {
        console.warn(
          "duckdb: local bundle failed:",
          bundle.worker,
          err && err.message ? err.message : err
        );
      }
    }
    throw new Error("All local bundles failed to instantiate");
  }

  // Minimal mock runner when real DuckDB cannot be loaded
  function mockRunSQL(sql) {
    sql = (sql || "").trim();
    // very simple SELECT parser: SELECT <expr> AS <name>
    try {
      const lowered = sql.toLowerCase();
      if (lowered.match(/^select\s+1(\s+as\s+\w+)?\s*;?$/)) {
        const colNameMatch = sql.match(/as\s+([a-z0-9_]+)/i);
        const colName = colNameMatch ? colNameMatch[1] : "one";
        return { success: true, result: { columns: [colName], data: [[1]] } };
      }
      // SELECT * FROM (mock)
      if (lowered.startsWith("select")) {
        // return a trivial mock table with one row
        return {
          success: true,
          result: { columns: ["mock_col"], data: [["mock_value"]] },
        };
      }
      // Non-select (CREATE, INSERT) - pretend success
      return { success: true, result: { columns: [], data: [] } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async function load() {
    if (_ready) return _ready;
    _ready = new Promise(async (resolve, reject) => {
      // Order: CDN -> Local -> Mock
      try {
        try {
          const res = await tryCdnBundles();
          return resolve(res);
        } catch (cdnErr) {
          console.warn(
            "duckdb: CDN init failed (will attempt local).",
            cdnErr && cdnErr.message ? cdnErr.message : cdnErr
          );
        }
        try {
          const res = await tryLocalBundles();
          return resolve(res);
        } catch (localErr) {
          console.warn(
            "duckdb: local init failed (will fallback to mock).",
            localErr && localErr.message ? localErr.message : localErr
          );
        }
        // fallback to mock
        _mode = "mock";
        console.warn(
          "duckdb: falling back to mock SQL runner — functionality limited."
        );
        resolve({ mock: true, mode: "mock" });
      } catch (err) {
        console.error(
          "duckdb: load failed completely",
          err && err.message ? err.message : err
        );
        reject(err);
      }
    });
    return _ready;
  }

  async function runSQL(sql) {
    try {
      await load();
      if (_mode === "mock") {
        return mockRunSQL(sql);
      }
      if (!_conn)
        return { success: false, error: "DuckDB connection not ready" };
      const result = await _conn.query(sql);
      // Normalize result to columns/data
      const columns =
        result?.columns ||
        (result?.schema && result.schema.map((s) => s.name)) ||
        [];
      const data = result?.data || result?.rows || [];
      return { success: true, result: { columns, data, raw: result } };
    } catch (err) {
      return {
        success: false,
        error: err && err.message ? err.message : String(err),
      };
    }
  }

  return { load, runSQL, _internal: { getMode: () => _mode } };
})();
