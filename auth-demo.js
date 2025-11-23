// js/auth-demo.js
// Demo authentication flow for JIRA (vishal-jira) and API token (vishal-token).
// Enhancements: persistent state, sign-up -> sign-out toggle, protect actions, modal keyboard UX.
// Relies on window.CIBC_UI.toast for toasts if available.

(function () {
  // Resolve scope root reliably (works if you use body[data-page="main"] or plain body)
  const ROOT =
    document.querySelector('body[data-page="main"]') || document.body;

  function qs(sel) {
    return ROOT.querySelector(sel);
  }
  function qsa(sel) {
    return Array.from(ROOT.querySelectorAll(sel));
  }

  function ensureErrorContainer(wrapper, id, defaultMsg = "") {
    let err = wrapper.querySelector(`#${id}`);
    if (!err) {
      err = document.createElement("div");
      err.id = id;
      err.className = "input-error hidden";
      err.setAttribute("role", "status");
      err.setAttribute("aria-live", "polite");
      if (defaultMsg) err.textContent = defaultMsg;
      wrapper.appendChild(err);
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

  function toast(msg, opts = {}) {
    if (window.CIBC_UI && typeof window.CIBC_UI.toast === "function") {
      window.CIBC_UI.toast(msg, opts);
    } else {
      // fallback
      console.log("Toast:", msg);
    }
  }

  // demo credentials
  const DEMO_JIRA = "vishal-jira";
  const DEMO_TOKEN = "vishal-token";

  // small helper to simulate async auth
  function delay(ms = 700) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // Helper: are we signed in (both demo creds present)?
  function isSignedIn() {
    try {
      return (
        localStorage.getItem("cibc_jira_key") === DEMO_JIRA &&
        sessionStorage.getItem("cibc_api_token") === DEMO_TOKEN
      );
    } catch (e) {
      return false;
    }
  }

  // reflect persisted state to UI and update signup control
  function applyAuthState() {
    const jiraKey = localStorage.getItem("cibc_jira_key");
    const apiToken = sessionStorage.getItem("cibc_api_token");

    // buttons
    const btnAuth = qs("#authenticateBtn");
    const btnConnect = qs("#connectBtn");

    // small status badges (create if missing)
    function ensureBadge(el, id) {
      if (!el) return null;
      let badge = el.parentElement.querySelector(`#${id}`);
      if (!badge) {
        badge = document.createElement("span");
        badge.id = id;
        badge.className = "muted small auth-badge";
        badge.style.marginLeft = "8px";
        el.parentElement.appendChild(badge);
      }
      return badge;
    }

    const badgeAuth = ensureBadge(btnAuth, "jiraStatus");
    const badgeConn = ensureBadge(btnConnect, "apiStatus");

    if (jiraKey === DEMO_JIRA) {
      if (btnAuth) {
        btnAuth.textContent = "Authenticated";
        btnAuth.classList.add("disabled");
        btnAuth.setAttribute("aria-pressed", "true");
      }
      if (badgeAuth) badgeAuth.textContent = "JIRA: connected";
    } else {
      if (btnAuth) {
        btnAuth.textContent = "Authenticate";
        btnAuth.classList.remove("disabled");
        btnAuth.removeAttribute("aria-pressed");
      }
      if (badgeAuth) badgeAuth.textContent = "";
    }

    if (apiToken === DEMO_TOKEN) {
      if (btnConnect) {
        btnConnect.textContent = "Authenticated";
        btnConnect.classList.add("disabled");
        btnConnect.setAttribute("aria-pressed", "true");
      }
      if (badgeConn) badgeConn.textContent = "API: connected";
    } else {
      if (btnConnect) {
        btnConnect.textContent = "Connect";
        btnConnect.classList.remove("disabled");
        btnConnect.removeAttribute("aria-pressed");
      }
      if (badgeConn) badgeConn.textContent = "";
    }

    // Protect key actions if API is not connected
    setActionProtection(Boolean(apiToken === DEMO_TOKEN));

    // Update signup control in navbar
    updateSignupControl();
  }

  // Disable or enable critical action buttons when not connected
  function setActionProtection(allowed) {
    // action selectors to protect
    const protectedSelectors = [
      "#importBtn",
      "#exportBtn",
      "#runAllBtn",
      "#updateDeltaBtn",
      "#runAsNewBtn",
      ".add-between-btn",
      "#addFinalBtn",
    ];
    protectedSelectors.forEach((sel) => {
      qsa(sel).forEach((el) => {
        // when allowed == false, disable the element and add tooltip/title
        if (!allowed) {
          el.dataset._wasDisabled = el.disabled ? "1" : "0";
          el.disabled = true;
          el.classList.add("disabled");
          if (!el.getAttribute("data-protect-tooltip")) {
            el.setAttribute("data-protect-tooltip", "Requires API connection");
            // set title for simple UX fallback
            el.setAttribute("title", "Requires API connection");
          }
        } else {
          // restore previous
          if (el.dataset._wasDisabled === "0") el.disabled = false;
          el.classList.remove("disabled");
          if (el.getAttribute("data-protect-tooltip")) {
            el.removeAttribute("data-protect-tooltip");
            el.removeAttribute("title");
          }
        }
      });
    });
  }

  // Update the signup button in the navbar to act as Sign up OR Sign out depending on state.
  function updateSignupControl() {
    const navRight =
      document.querySelector(".nav-right") ||
      document.querySelector("header .nav-row");
    if (!navRight) return;
    let signupEl =
      navRight.querySelector(".btn.signup") ||
      navRight.querySelector("#signupBtn") ||
      null;
    if (!signupEl) {
      // fallback: create a signup-like button if none exists
      signupEl = document.createElement("button");
      signupEl.className = "btn signup";
      signupEl.id = "signupBtn";
      signupEl.textContent = "Sign up";
      navRight.insertBefore(signupEl, navRight.firstChild);
    }

    // remove any previous click handlers we may have attached by replacing with a fresh one
    // (safer than trying to remove specific listeners)
    const newEl = signupEl.cloneNode(true);
    signupEl.parentElement.replaceChild(newEl, signupEl);
    signupEl = newEl;

    if (isSignedIn()) {
      // Signed in: show "Sign out"
      signupEl.textContent = "Sign out";
      signupEl.classList.remove("signup");
      signupEl.classList.add("btn", "ghost"); // keep styling consistent
      signupEl.setAttribute("title", "Sign out");
      signupEl.addEventListener("click", (ev) => {
        ev.preventDefault();
        // Clear demo storage
        try {
          localStorage.removeItem("cibc_jira_key");
          sessionStorage.removeItem("cibc_api_token");
        } catch (e) {}
        toast("Signed out (demo)", { duration: 1400 });
        // revert UI
        applyAuthState();
      });
    } else {
      // Not signed in: show "Sign up" which opens modal
      signupEl.textContent = "Sign up";
      signupEl.classList.add("signup");
      signupEl.setAttribute("title", "Sign up / Sign in");
      signupEl.addEventListener("click", (ev) => {
        ev.preventDefault();
        const modal = document.getElementById("signupModal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.setAttribute("aria-hidden", "false");
          const u = modal.querySelector("#modalUser");
          if (u) setTimeout(() => u.focus(), 40);
        }
      });
    }
  }

  async function initAuthDemo() {
    // wire buttons for JIRA auth
    const jiraInput = qs("#jiraKey");
    const authBtn = qs("#authenticateBtn");

    if (jiraInput && authBtn) {
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
        const originalText = authBtn.textContent;
        authBtn.textContent = "Authenticating…";

        await delay(800);

        if (val === DEMO_JIRA) {
          try {
            localStorage.setItem("cibc_jira_key", val);
          } catch (e) {}
          hideError(group, jiraInput, jiraError);
          toast("JIRA authenticated — user connected", {
            duration: 2200,
            type: "success",
          });
          // lock button
          authBtn.textContent = "Authenticated";
          authBtn.classList.add("disabled");
          authBtn.setAttribute("aria-pressed", "true");
        } else {
          showError(
            group,
            jiraInput,
            jiraError,
            "Invalid JIRA key. Use demo key: vishal-jira"
          );
          toast("JIRA authentication failed", {
            duration: 2200,
            type: "error",
          });
          authBtn.textContent = originalText;
          jiraInput.focus();
        }

        authBtn.disabled = false;
        applyAuthState();
      });
    }

    // API token connect
    const apiInput = qs("#apiKey");
    const connectBtn = qs("#connectBtn");

    if (apiInput && connectBtn) {
      const parentCol =
        apiInput.closest(".input-row")?.parentElement ||
        apiInput.closest(".sidebar") ||
        apiInput.closest("aside") ||
        document.body;
      const apiError = ensureErrorContainer(parentCol, "apiError", "");

      connectBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const group = apiInput.closest(".input-group");
        const val = (apiInput.value || "").trim();

        connectBtn.disabled = true;
        const originalText = connectBtn.textContent;
        connectBtn.textContent = "Connecting…";

        await delay(700);

        if (val === DEMO_TOKEN) {
          try {
            sessionStorage.setItem("cibc_api_token", val);
          } catch (e) {}
          hideError(group, apiInput, apiError);
          toast("API token accepted — connection established", {
            duration: 2200,
            type: "success",
          });
          connectBtn.textContent = "Authenticated";
          connectBtn.classList.add("disabled");
          connectBtn.setAttribute("aria-pressed", "true");
        } else {
          showError(
            group,
            apiInput,
            apiError,
            "Invalid API token. Use demo token: vishal-token"
          );
          toast("API token invalid", { duration: 2200, type: "error" });
          connectBtn.textContent = originalText;
          apiInput.focus();
        }

        connectBtn.disabled = false;
        applyAuthState();
      });
    }

    // Generic processing for buttons with data-action="process"
    qsa('button[data-action="process"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        // if action is protected and api is not connected, block
        const apiConnected =
          sessionStorage.getItem("cibc_api_token") === DEMO_TOKEN;
        if (!apiConnected) {
          toast("Please connect API token to perform this action", {
            duration: 2000,
            type: "error",
          });
          return;
        }
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Processing…";
        await delay(600);
        btn.textContent = orig;
        btn.disabled = false;
        toast(`${orig} — done`, { duration: 1500 });
      });
    });
  }

  // modal wiring (signup) — kept at bottom for clarity
  function modalWire() {
    const signupBtn =
      document.querySelector(".nav-right .btn.signup") ||
      qs("#signupBtn") ||
      null;
    const modal = document.getElementById("signupModal");
    if (!modal) return;

    function openModal() {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      const u = modal.querySelector("#modalUser");
      if (u) setTimeout(() => u.focus(), 40);
    }
    function closeModal() {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }

    // signup button behavior is handled in updateSignupControl, but ensure fallback
    signupBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });

    modal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeModal();
      });
    });

    // close modal on ESC
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (!modal.classList.contains("hidden")) closeModal();
      }
    });

    const modalSignInBtn = document.getElementById("modalSignInBtn");
    modalSignInBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const user = (document.getElementById("modalUser")?.value || "").trim();
      const token = (document.getElementById("modalToken")?.value || "").trim();

      if (user !== DEMO_JIRA || token !== DEMO_TOKEN) {
        toast("Invalid demo credentials", { duration: 2200, type: "error" });
        return;
      }

      try {
        localStorage.setItem("cibc_jira_key", user);
        sessionStorage.setItem("cibc_api_token", token);
      } catch (e) {
        /* ignore storage errors */
      }

      toast("Signed in (demo)", { duration: 1600, type: "success" });

      // reflect button states
      const btnAuth = qs("#authenticateBtn");
      const btnConnect = qs("#connectBtn");
      if (btnAuth) {
        btnAuth.textContent = "Authenticated";
        btnAuth.classList.add("disabled");
        btnAuth.setAttribute("aria-pressed", "true");
      }
      if (btnConnect) {
        btnConnect.textContent = "Authenticated";
        btnConnect.classList.add("disabled");
        btnConnect.setAttribute("aria-pressed", "true");
      }

      closeModal();
      applyAuthState();
    });
  }

  // initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initAuthDemo().catch((e) => console.error("initAuthDemo error", e));
      modalWire();
      // reflect any persisted state immediately
      applyAuthState();
    });
  } else {
    initAuthDemo().catch((e) => console.error("initAuthDemo error", e));
    modalWire();
    applyAuthState();
  }
})();
