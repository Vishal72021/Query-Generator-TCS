// js/ai.js
// AI helpers – by default call a mock server endpoint /api/ai which you can replace with real endpoint.
// Each method returns { ok, text } or { ok:false, error }

const AI_ENDPOINT = "/api/ai"; // swap with real AI endpoint later
const DEMO_PATH = "";

async function callAi(action, payload) {
  // if running without backend, return mocked responses
  if (!window.location.hostname || window.location.hostname === "localhost") {
    // simple mocked reply (deterministic)
    return {
      ok: true,
      text: `Mock ${action} result for code:\n\n${
        payload && payload.code ? payload.code.replace(/\n/g, "\n> ") : ""
      }`,
    };
  }
  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!resp.ok) return { ok: false, error: "AI server error " + resp.status };
    const data = await resp.json();
    return { ok: true, text: data.text || data.result || "" };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function aiExplain(code) {
  return await callAi("explain", { code, demoPath: DEMO_PATH });
}
export async function aiFix(code) {
  return await callAi("fix", { code });
}
export async function aiImprove(code) {
  return await callAi("improve", { code });
}
export async function aiConvert(code, toLang) {
  return await callAi("convert", { code, toLang });
}
