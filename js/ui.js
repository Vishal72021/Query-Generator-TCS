// js/ui.js
// General UI enhancements: theming, animations, scroll polish.
// Updated: robust theme toggler, centralised APIs, system-pref fallback.

console.log("ui.js loaded");

// ------------------------------
// THEME SWITCHER (centralized)
// ------------------------------
const THEME_KEY = "cibc_theme";
const html = document.documentElement;
const themeToggleEl = document.getElementById("themeToggle");

// allowed canonical themes (matches tokens.css)
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const LEGACY_MAP = {
  // map legacy names to canonical ones
  red: THEME_LIGHT,
  white: THEME_LIGHT,
  black: THEME_DARK,
  dark: THEME_DARK,
  light: THEME_LIGHT,
};

/**
 * normalizeTheme - convert any legacy/unknown theme into "light" or "dark"
 */
function normalizeTheme(t) {
  if (!t || typeof t !== "string") return null;
  t = t.trim().toLowerCase();
  if (LEGACY_MAP[t]) return LEGACY_MAP[t];
  // unknown -> prefer light
  if (t === THEME_DARK) return THEME_DARK;
  return THEME_LIGHT;
}

/**
 * applyTheme - set html[data-theme] and persist to localStorage
 * Also updates the theme toggle button aria-pressed
 */
function applyTheme(theme) {
  const normalized = normalizeTheme(theme) || THEME_LIGHT;
  html.setAttribute("data-theme", normalized);
  try {
    localStorage.setItem(THEME_KEY, normalized);
  } catch (e) {
    // non-fatal
  }
  // reflect on toggler if present
  if (themeToggleEl) {
    themeToggleEl.setAttribute("aria-pressed", normalized === THEME_DARK ? "true" : "false");
    themeToggleEl.classList.toggle("is-dark", normalized === THEME_DARK);
    themeToggleEl.classList.toggle("is-light", normalized === THEME_LIGHT);
  }
  // expose current on CIBC UI
  window.CIBC_UI = window.CIBC_UI || {};
  window.CIBC_UI.currentTheme = normalized;
  return normalized;
}

/**
 * readSavedTheme - returns persisted theme, or null if none
 */
function readSavedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return normalizeTheme(v);
  } catch (e) {
    return null;
  }
}

/**
 * getSystemPref - read prefers-color-scheme
 */
function getSystemPref() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return THEME_DARK;
    }
  } catch (e) {}
  return THEME_LIGHT;
}

/**
 * loadTheme - choose theme using saved -> system -> default
 */
function loadTheme() {
  // order: explicit saved (localStorage) -> html attribute (legacy pages) -> system -> default(light)
  const saved = readSavedTheme();
  if (saved) {
    return applyTheme(saved);
  }

  // if html already has data-theme (maybe set server-side or by older script), normalize it
  const currentHtml = normalizeTheme(html.getAttribute("data-theme"));
  if (currentHtml) {
    return applyTheme(currentHtml);
  }

  // else check system
  const sys = getSystemPref();
  return applyTheme(sys);
}

/**
 * toggleTheme - flips between light and dark
 */
function toggleTheme() {
  const cur = normalizeTheme(html.getAttribute("data-theme")) || THEME_LIGHT;
  const next = cur === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return applyTheme(next);
}

// expose helpers on global object for other modules to use
window.CIBC_UI = window.CIBC_UI || {};
window.CIBC_UI.setTheme = applyTheme;
window.CIBC_UI.getTheme = () => normalizeTheme(html.getAttribute("data-theme")) || THEME_LIGHT;
window.CIBC_UI.toggleTheme = toggleTheme;

// wire up the button (single binding, safe to call multiple times)
function wireThemeTogglerButton() {
  const btn = themeToggleEl;
  if (!btn) return;
  // avoid double-binding: if we already bound, skip
  if (btn.__cibc_bound) return;
  btn.__cibc_bound = true;

  // mark initial aria-pressed based on current theme
  const cur = normalizeTheme(html.getAttribute("data-theme")) || THEME_LIGHT;
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-pressed", cur === THEME_DARK ? "true" : "false");
  btn.classList.toggle("is-dark", cur === THEME_DARK);

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    // delegate to centralized toggler
    const next = toggleTheme();
    // small feedback: a11y
    btn.setAttribute("aria-pressed", next === THEME_DARK ? "true" : "false");
    // optional small animation/tap
    btn.animate([{ transform: "scale(0.98)" }, { transform: "scale(1)" }], {
      duration: 160,
      easing: "cubic-bezier(.2,.9,.25,1)",
    });
  });
}

// ------------------------------
// NAVBAR SCROLL EFFECT (subtle shrink)
// ------------------------------
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  if (window.scrollY > 10) {
    nav.style.transform = "translateY(-2px)";
    nav.style.boxShadow = "0 8px 28px rgba(var(--accent-rgb),0.30)";
  } else {
    nav.style.transform = "translateY(0)";
    nav.style.boxShadow = "0 10px 24px rgba(var(--accent-rgb),0.25)";
  }
});

// ------------------------------
// TOASTS — small, reusable function
// ------------------------------
(function () {
  // create container
  const toastContainerId = "cibc-toast-container";
  function ensureContainer() {
    let el = document.getElementById(toastContainerId);
    if (!el) {
      el = document.createElement("div");
      el.id = toastContainerId;
      el.style.position = "fixed";
      el.style.right = "18px";
      el.style.bottom = "18px";
      el.style.zIndex = 11000;
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.gap = "10px";
      document.body.appendChild(el);
    }
    return el;
  }

  function createToast(msg, opts = {}) {
    const { duration = 2600, type = "default" } = opts;
    const container = ensureContainer();
    const t = document.createElement("div");
    t.className =
      "cibc-toast " +
      (type === "success"
        ? "cibc-toast-success"
        : type === "error"
        ? "cibc-toast-error"
        : "");
    t.textContent = msg;
    t.style.minWidth = "180px";
    t.style.maxWidth = "360px";
    t.style.padding = "10px 12px";
    t.style.borderRadius = "10px";
    t.style.boxShadow = "0 8px 22px rgba(2,6,23,0.12)";
    t.style.background =
      type === "success"
        ? "linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))"
        : type === "error"
        ? "linear-gradient(180deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))"
        : "linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02))";
    t.style.color = "#07122a";
    t.style.fontWeight = "600";
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    t.style.transition =
      "opacity 220ms ease, transform 220ms cubic-bezier(.2,.9,.25,1)";
    container.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      setTimeout(() => t.remove(), 280);
    }, duration);
  }

  window.CIBC_UI = window.CIBC_UI || {};
  window.CIBC_UI.toast = createToast;
})();

// ------------------------------
// Initialization
// ------------------------------
(function init() {
  // load theme first (so CSS variables are available immediately)
  loadTheme();

  // wire the toggler button (if present)
  wireThemeTogglerButton();

  // keep a global handy reference
  window.CIBC_UI = window.CIBC_UI || {};
  window.CIBC_UI.setTheme = applyTheme;
  window.CIBC_UI.getTheme = () => normalizeTheme(html.getAttribute("data-theme")) || THEME_LIGHT;
  window.CIBC_UI.toggleTheme = toggleTheme;
})();
