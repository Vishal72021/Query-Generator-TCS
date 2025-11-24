// js/auth-demo.js
// Demo authentication & UI wiring
// - JIRA demo key: "vishal-jira"
// - API demo token: "vishal-token"
// - Modal sign-in: email= "vishal.tripathy@cibc.com", password = "CIBC@project123"

(function () {
  // small helpers
  const DEMO_JIRA = "vishal-jira";
  const DEMO_TOKEN = "vishal-token";
  const DEMO_EMAIL = "vishal.tripathy@cibc.com";
  const DEMO_PW = "CIBC@project123";

  function toast(msg, opts = {}) {
    if (window.CIBC_UI && typeof window.CIBC_UI.toast === "function") {
      window.CIBC_UI.toast(msg, opts);
    } else {
      console.log("Toast:", msg, opts);
    }
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  // utility: ensure there is a single sign button in .nav-right inserted before the theme toggler
  function ensureSignButton() {
    const navRight = qs(".nav-right");
    if (!navRight) return null;

    // remove stray sign-out buttons that are not the primary one (defensive)
    qsa(".nav-right .btn.signin, .nav-right .btn.signup").forEach((b, i) => {
      // keep only the first one
      if (i > 0) b.remove();
    });

    let btn = navRight.querySelector(".btn.signin, .btn.signup");
    const togg = qs("#themeToggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "btn signup";
      // insert before theme toggler if present, else append
      if (togg) navRight.insertBefore(btn, togg);
      else navRight.appendChild(btn);
    } else {
      // ensure it sits before the toggler
      if (togg && btn.nextElementSibling !== togg) {
        navRight.insertBefore(btn, togg);
      }
    }
    return btn;
  }

  // protect or enable action buttons depending on state
  function setActionProtection({
    apiConnected = false,
    signedIn = false,
  } = {}) {
    // Protected until API validated: updateDeltaBtn
    const updateBtn = qs("#updateDeltaBtn");
    if (updateBtn) {
      updateBtn.disabled = !apiConnected;
      updateBtn.classList.toggle("disabled", !apiConnected);
    }

    // runAll & runAsNew are enabled after sign-in (even without API) per requirement
    const runAll = qs("#runAllBtn");
    const runNew = qs("#runAsNewBtn");
    if (runAll) {
      runAll.disabled = !signedIn;
      runAll.classList.toggle("disabled", !signedIn);
    }
    if (runNew) {
      runNew.disabled = !signedIn;
      runNew.classList.toggle("disabled", !signedIn);
    }

    // protect import/export until API is validated (optional)
    qsa("#importBtn, #exportBtn").forEach((b) => {
      b.disabled = !apiConnected;
      b.classList.toggle("disabled", !apiConnected);
    });
  }

  // update navbar sign-in/out button state
  function applySignButton(signedIn) {
    const btn = ensureSignButton();
    if (!btn) return;
    btn.onclick = null;
    if (signedIn) {
      btn.textContent = "Sign out";
      btn.classList.remove("signup");
      btn.classList.add("signin");
      btn.onclick = (e) => {
        e.preventDefault();
        // clear persisted demo credentials and sign-in flag
        try {
          localStorage.removeItem("cibc_jira_key");
          sessionStorage.removeItem("cibc_api_token");
          sessionStorage.removeItem("cibc_signed_in");
        } catch (err) {}
        toast("Signed out (demo)", { type: "info", duration: 1200 });
        applySignButton(false);
        setActionProtection({ apiConnected: false, signedIn: false });
      };
    } else {
      btn.textContent = "Sign in";
      btn.classList.remove("signin");
      btn.classList.add("signup");
      btn.onclick = (e) => {
        e.preventDefault();
        const modal = qs("#signupModal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.setAttribute("aria-hidden", "false");
          const u = modal.querySelector("#modalUser");
          if (u) setTimeout(() => u.focus(), 40);
        }
      };
    }
  }

  // ensure single error container appended under right parent
  function ensureErrorContainer(parent, id, defaultMsg = "") {
    if (!parent) parent = document.body;
    let err = parent.querySelector(`#${id}`);
    if (!err) {
      err = document.createElement("div");
      err.id = id;
      err.className = "input-error hidden";
      err.setAttribute("role", "status");
      err.setAttribute("aria-live", "polite");
      if (defaultMsg) err.textContent = defaultMsg;
      parent.appendChild(err);
    }
    return err;
  }
  function showError(group, inputEl, errEl, message) {
    if (group) group.classList.add("invalid");
    if (inputEl) inputEl.setAttribute("aria-invalid", "true");
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove("hidden");
      errEl.classList.add("show");
    }
  }
  function hideError(group, inputEl, errEl) {
    if (group) group.classList.remove("invalid");
    if (inputEl) inputEl.removeAttribute("aria-invalid");
    if (errEl) {
      errEl.classList.remove("show");
      errEl.classList.add("hidden");
    }
  }

  // wire theme toggler — robust cycle between red -> white -> black
  function wireThemeToggler() {
    const togg = qs("#themeToggle");
    if (!togg) return;
    const themes = ["red", "white", "black"];
    function currentTheme() {
      return document.documentElement.getAttribute("data-theme") || "red";
    }
    function applyTheme(t) {
      document.documentElement.setAttribute("data-theme", t);
      togg.setAttribute("aria-pressed", t === "black" ? "true" : "false");
      try {
        localStorage.setItem("cibc_theme", t);
      } catch (e) {}
    }
    // load saved
    const stored = localStorage.getItem("cibc_theme");
    if (stored && themes.includes(stored)) applyTheme(stored);
    togg.style.display = "inline-flex"; // defensive
    togg.addEventListener("click", (e) => {
      e.preventDefault();
      const cur = currentTheme();
      const idx = themes.indexOf(cur);
      const next = themes[(idx + 1) % themes.length];
      applyTheme(next);
      toast(`Theme: ${next}`, { duration: 900 });
    });
  }

  // main initialization
  function init() {
    // wire toggler immediately
    wireThemeToggler();

    // fill sign button initial state
    const signed = !!sessionStorage.getItem("cibc_signed_in");
    applySignButton(signed);

    // JIRA authenticate button
    const jiraInput = qs("#jiraKey");
    const authBtn = qs("#authenticateBtn");
    if (authBtn && jiraInput) {
      const parentCol =
        jiraInput.closest(".input-row")?.parentElement ||
        jiraInput.closest("section") ||
        document.body;
      const jiraError = ensureErrorContainer(parentCol, "jiraError", "");
      authBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const group = jiraInput.closest(".input-group");
        const val = (jiraInput.value || "").trim();
        authBtn.disabled = true;
        const orig = authBtn.textContent;
        authBtn.textContent = "Authenticating…";
        await new Promise((r) => setTimeout(r, 700));
        if (val === DEMO_JIRA) {
          try {
            localStorage.setItem("cibc_jira_key", val);
          } catch (e) {}
          hideError(group, jiraInput, jiraError);
          authBtn.textContent = "Authenticated";
          authBtn.classList.add("disabled");
          toast("JIRA authenticated — user connected", {
            type: "success",
            duration: 1600,
          });
        } else {
          showError(
            group,
            jiraInput,
            jiraError,
            `Invalid JIRA key. Use demo: ${DEMO_JIRA}`
          );
          authBtn.textContent = orig;
          toast("JIRA authentication failed", {
            type: "error",
            duration: 1600,
          });
          jiraInput.focus();
        }
        authBtn.disabled = false;
        // Note: update to delta remains disabled until API token validated
        // keep runAll/runAsNew unchanged by this action
      });
    }

    // API connect
    const apiInput = qs("#apiKey");
    const connectBtn = qs("#connectBtn");
    if (connectBtn && apiInput) {
      const parentCol =
        apiInput.closest(".sidebar") ||
        apiInput.closest("aside") ||
        document.body;
      const apiError = ensureErrorContainer(parentCol, "apiError", "");
      connectBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const group = apiInput.closest(".input-group");
        const val = (apiInput.value || "").trim();
        connectBtn.disabled = true;
        const orig = connectBtn.textContent;
        connectBtn.textContent = "Connecting…";
        await new Promise((r) => setTimeout(r, 700));
        if (val === DEMO_TOKEN) {
          try {
            sessionStorage.setItem("cibc_api_token", val);
          } catch (e) {}
          hideError(group, apiInput, apiError);
          connectBtn.textContent = "Authenticated";
          connectBtn.classList.add("disabled");
          toast("API token accepted — connection established", {
            type: "success",
            duration: 1600,
          });
        } else {
          showError(
            group,
            apiInput,
            apiError,
            `Invalid API token. Use demo: ${DEMO_TOKEN}`
          );
          connectBtn.textContent = orig;
          toast("API token invalid", { type: "error", duration: 1600 });
          apiInput.focus();
        }
        connectBtn.disabled = false;
        // Update protection for updateDelta
        const apiConnected =
          sessionStorage.getItem("cibc_api_token") === DEMO_TOKEN;
        const signedIn = !!sessionStorage.getItem("cibc_signed_in");
        setActionProtection({ apiConnected, signedIn });
      });
    }

    // modal wiring (sign-in modal logic)
    const modal = qs("#signupModal");
    const modalSignInBtn = qs("#modalSignInBtn");
    if (modal && modalSignInBtn) {
      modalSignInBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const user = (qs("#modalUser", modal)?.value || "").trim();
        const pw = (qs("#modalToken", modal)?.value || "").trim();

        if (user === DEMO_EMAIL && pw === DEMO_PW) {
          // mark user as signed-in (session-only)
          try {
            sessionStorage.setItem("cibc_signed_in", "1");
          } catch (e) {}
          toast("Signed in (demo)", { type: "success", duration: 1400 });
          // enable runAll & runAsNew, but leave updateDelta disabled until API token validated
          const apiConnected =
            sessionStorage.getItem("cibc_api_token") === DEMO_TOKEN;
          setActionProtection({ apiConnected, signedIn: true });
          applySignButton(true);
          // close modal
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden", "true");
        } else {
          toast("Invalid sign-in credentials", {
            type: "error",
            duration: 1800,
          });
        }
      });

      // close controls
      modal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden", "true");
        });
      });

      // close on ESC
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !modal.classList.contains("hidden")) {
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden", "true");
        }
      });
    }

    // Initialize protection on load (based on current session)
    const apiConnected =
      sessionStorage.getItem("cibc_api_token") === DEMO_TOKEN;
    const signedIn = !!sessionStorage.getItem("cibc_signed_in");
    setActionProtection({ apiConnected, signedIn });
    applySignButton(signedIn);
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
