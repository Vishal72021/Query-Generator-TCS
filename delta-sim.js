// js/delta-sim.js
// Simple IndexedDB-backed Delta simulation: store versions of "tables" as arrays.
// API: DeltaSim.createTable(name, rows), upsert(name, rows, keyCols), readVersion(name, versionIndex), listVersions(name)

export const DeltaSim = (function () {
  const DB_NAME = "cibc_delta";
  const STORE = "tables";
  let dbp = null;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE, { keyPath: "name" });
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    return dbp;
  }

  async function getTableRecord(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const st = tx.objectStore(STORE);
      const r = st.get(name);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }

  async function putTableRecord(rec) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      const r = st.put(rec);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function createTable(name, rows = []) {
    const rec = (await getTableRecord(name)) || { name, versions: [] };
    rec.versions.push({ ts: Date.now(), rows });
    await putTableRecord(rec);
    return { ok: true };
  }

  async function upsert(name, rows, keyCols = ["id"]) {
    const rec = (await getTableRecord(name)) || { name, versions: [] };
    const last = rec.versions.length
      ? JSON.parse(JSON.stringify(rec.versions[rec.versions.length - 1].rows))
      : [];
    // naive upsert: replace rows matching keyCols, else append
    const keySig = (r) => keyCols.map((k) => r[k]).join("||");
    const map = new Map(last.map((r) => [keySig(r), r]));
    rows.forEach((r) => map.set(keySig(r), r));
    const merged = Array.from(map.values());
    rec.versions.push({ ts: Date.now(), rows: merged });
    await putTableRecord(rec);
    return { ok: true, version: rec.versions.length - 1 };
  }

  async function readVersion(name, versionIndex = -1) {
    const rec = await getTableRecord(name);
    if (!rec) return { ok: false, error: "table not found" };
    if (versionIndex < 0) versionIndex = rec.versions.length - 1;
    const v = rec.versions[versionIndex];
    return { ok: true, version: versionIndex, ts: v.ts, rows: v.rows };
  }

  async function listVersions(name) {
    const rec = await getTableRecord(name);
    if (!rec) return { ok: false, error: "table not found" };
    return {
      ok: true,
      versions: rec.versions.map((v, i) => ({
        i,
        ts: v.ts,
        rows: v.rows.length,
      })),
    };
  }

  return { createTable, upsert, readVersion, listVersions };
})();
