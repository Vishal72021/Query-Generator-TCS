// js/auth-demo.js
// Demo authentication flow for JIRA (vishal-jira) and API token (vishal-token).
// Shows toasts via window.CIBC_UI.toast, updates button text states,
// and uses input-error containers created by inputs.js validation helpers.

(function () {
  const PAGE_SCOPE = 'body[data-page="main"]';

  function inScope(selector) {
    return document.querySelector(`${PAGE_SCOPE} ${selector}`);
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

  // small helper to simulate async auth
  function delay(ms = 700) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function initAuthDemo() {
    // JIRA auth
    const jiraInput = inScope("#jiraKey");
    const authBtn = inScope("#authenticateBtn");

    if (jiraInput && authBtn) {
      // find a good parent column to append error (per layout)
      const parentCol =
        jiraInput.closest(".input-row")?.parentElement ||
        jiraInput.closest("section") ||
        document.body;
      const jiraError = ensureErrorContainer(parentCol, "jiraError", "");

      authBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const group = jiraInput.closest(".input-group");
        const val = (jiraInput.value || "").trim();

        // set state
        authBtn.disabled = true;
        const originalText = authBtn.textContent;
        authBtn.textContent = "Authenticating…";

        // small UX delay
        await delay(800);

        // demo check
        if (val === "vishal-jira") {
          // success
          try {
            localStorage.setItem("cibc_jira_key", val);
          } catch (e) {}
          hideError(group, jiraInput, jiraError);
          authBtn.textContent = "Authenticated";
          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast("JIRA authenticated — user connected", {
              duration: 2500,
              type: "success",
            });
          // reflect state visually
          authBtn.classList.add("disabled"); // prevents further changes (you can adjust)
        } else {
          showError(
            group,
            jiraInput,
            jiraError,
            "Invalid JIRA key. Use demo key: vishal-jira"
          );
          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast("JIRA authentication failed", {
              duration: 2200,
              type: "error",
            });
          authBtn.textContent = originalText;
        }

        authBtn.disabled = false;
      });
    }

    // API token connect
    const apiInput = inScope("#apiKey");
    const connectBtn = inScope("#connectBtn");

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

        if (val === "vishal-token") {
          try {
            sessionStorage.setItem("cibc_api_token", val);
          } catch (e) {}
          hideError(group, apiInput, apiError);
          connectBtn.textContent = "Authenticated";
          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast(
              "API token accepted — connection established",
              { duration: 2500, type: "success" }
            );
          connectBtn.classList.add("disabled");
        } else {
          showError(
            group,
            apiInput,
            apiError,
            "Invalid API token. Use demo token: vishal-token"
          );
          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast("API token invalid", {
              duration: 2200,
              type: "error",
            });
          connectBtn.textContent = originalText;
        }

        connectBtn.disabled = false;
      });
    }

    // Generic button processing: when clicked, if it has data-action="process" simulate processing and show toast
    document
      .querySelectorAll(`${PAGE_SCOPE} button[data-action="process"]`)
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const orig = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Processing…";
          await delay(600);
          btn.textContent = orig;
          btn.disabled = false;
          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast(`${orig} — done`, { duration: 1500 });
        });
      });
  }

  // init
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initAuthDemo);
  else initAuthDemo();
})();

// simple modal wiring (at end of auth-demo.js)
(function modalWire() {
  const signupBtn = document.querySelector("button.btn.signup");
  const modal = document.getElementById("signupModal");
  if (!modal) return;
  function openModal() {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  // open on signup click
  signupBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  // close buttons
  modal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      closeModal();
    });
  });

  // modal sign in: use demo creds to authenticate both jira & api in modal
  const modalSignInBtn = document.getElementById("modalSignInBtn");
  modalSignInBtn?.addEventListener("click", (ev) => {
    ev.preventDefault();
    const user = document.getElementById("modalUser").value.trim();
    const token = document.getElementById("modalToken").value.trim();
    // quick validation
    if (user !== "vishal-jira" || token !== "vishal-token") {
      if (window.CIBC_UI?.toast)
        window.CIBC_UI.toast("Invalid demo credentials", {
          duration: 2200,
          type: "error",
        });
      return;
    }
    // persist both (demo)
    try {
      localStorage.setItem("cibc_jira_key", user);
      sessionStorage.setItem("cibc_api_token", token);
    } catch (e) {}
    if (window.CIBC_UI?.toast)
      window.CIBC_UI.toast("Signed in (demo)", {
        duration: 1800,
        type: "success",
      });
    closeModal();
    // reflect button states: set authenticate and connect to Authenticated
    const btnAuth = document.getElementById("authenticateBtn");
    const btnConnect = document.getElementById("connectBtn");
    if (btnAuth) {
      btnAuth.textContent = "Authenticated";
      btnAuth.classList.add("disabled");
    }
    if (btnConnect) {
      btnConnect.textContent = "Authenticated";
      btnConnect.classList.add("disabled");
    }
  });
})();
