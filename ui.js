// js/ui.js
// General UI enhancements: theming, animations, scroll polish.

console.log("ui.js loaded");

// ------------------------------
// THEME SWITCHER
// ------------------------------
const THEME_KEY = "cibc_theme";
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function applyTheme(t) {
  html.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "red";
  applyTheme(saved);
}

themeToggle?.addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next =
    current === "black" ? "white" : current === "white" ? "red" : "black";
  applyTheme(next);
});

loadTheme();

// ------------------------------
// NAVBAR SCROLL EFFECT (subtle shrink)
// ------------------------------
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if (window.scrollY > 10) {
    nav.style.transform = "translateY(-2px)";
    nav.style.boxShadow = "0 8px 28px rgba(var(--accent-rgb),0.30)";
  } else {
    nav.style.transform = "translateY(0)";
    nav.style.boxShadow = "0 10px 24px rgba(var(--accent-rgb),0.25)";
  }
});

// TOASTS — small, reusable function (append to js/ui.js)
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
