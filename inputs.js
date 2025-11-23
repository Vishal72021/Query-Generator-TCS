// js/inputs-validation.js
// Consolidated JIRA + API validation + error-line-below behavior
// Demo asset (your uploaded file path for reference):
// /mnt/data/CIBC Notebook — Index - Opera 2025-11-22 22-38-31.mp4

(function () {
  const PAGE_SCOPE = 'body[data-page="main"]';

  function inScope(selector) {
    return document.querySelector(`${PAGE_SCOPE} ${selector}`);
  }
  function allInScope(selector) {
    return Array.from(document.querySelectorAll(`${PAGE_SCOPE} ${selector}`));
  }

  // helper to ensure an error container exists below the input-row
  function ensureErrorContainer(wrapper, id, defaultMsg) {
    // wrapper is the element that contains the input-row (e.g. the column div)
    // we will append an error div with id if none exists
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

  // JIRA key validator (allow letters, numbers, dash and underscore)
  function isValidJiraKey(v) {
    if (!v) return false;
    return /^[A-Za-z0-9_-]+$/.test(v.trim());
  }

  // Show error (adds .invalid to group, sets aria-invalid, shows message)
  function showInputError(group, inputEl, errEl, message) {
    if (group) group.classList.add("invalid");
    if (inputEl) inputEl.setAttribute("aria-invalid", "true");
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove("hidden");
      errEl.classList.add("show");
    }
  }

  // Hide error (remove .invalid, aria-invalid, hide message)
  function hideInputError(group, inputEl, errEl) {
    if (group) group.classList.remove("invalid");
    if (inputEl) inputEl.removeAttribute("aria-invalid");
    if (errEl) {
      errEl.classList.remove("show");
      errEl.classList.add("hidden");
      // keep text content for accessibility but you can clear if desired:
      // errEl.textContent = '';
    }
  }

  function initValidation() {
    // JIRA input + authenticate button
    const jiraInput = inScope("#jiraKey");
    const authenticateBtn = inScope("#authenticateBtn");

    if (jiraInput) {
      // find wrapper area to append error (the nearest parent column)
      const jiraWrapperColumn = jiraInput
        .closest(".intro")
        ?.querySelector(".intro-grid")
        ? jiraInput.closest(".intro-grid")
        : jiraInput.closest("div")?.parentElement || document.body;
      // safer: prefer the column that contains this input-row (the immediate parent container of the input-row)
      // but to be predictable we find the nearest ancestor that is a direct column used in your intro snippet:
      let column =
        jiraInput.closest(".input-row")?.parentElement ||
        jiraInput.closest(".intro") ||
        jiraInput.closest("section") ||
        document.body;
      const jiraError = ensureErrorContainer(column, "jiraError", "");

      // live validation: show/hide error as user types
      jiraInput.addEventListener("input", () => {
        const val = (jiraInput.value || "").trim();
        const group = jiraInput.closest(".input-group");
        if (val === "" || isValidJiraKey(val)) {
          hideInputError(group, jiraInput, jiraError);
          // also toggle has-value (if you are using that class)
          if (val) group && group.classList.add("has-value");
          else group && group.classList.remove("has-value");
        } else {
          showInputError(
            group,
            jiraInput,
            jiraError,
            "JIRA key must be alphanumeric (letters, numbers, - or _)."
          );
        }
      });

      // optional: also validate on blur (user leaves field)
      jiraInput.addEventListener("blur", () => {
        const val = (jiraInput.value || "").trim();
        const group = jiraInput.closest(".input-group");
        if (!val) {
          // hide or show per your UX preference; here we hide when empty
          hideInputError(group, jiraInput, jiraError);
          return;
        }
        if (!isValidJiraKey(val)) {
          showInputError(
            group,
            jiraInput,
            jiraError,
            "JIRA key must be alphanumeric (letters, numbers, - or _)."
          );
        } else {
          hideInputError(group, jiraInput, jiraError);
        }
      });

      // authenticate button click (similar to your API handler style)
      if (authenticateBtn) {
        authenticateBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const group = jiraInput.closest(".input-group");
          const val = (jiraInput.value || "").trim();
          if (!val || !isValidJiraKey(val)) {
            showInputError(
              group,
              jiraInput,
              jiraError,
              "JIRA key must be alphanumeric (letters, numbers, - or _)."
            );
            jiraInput.focus();
            return;
          }

          // success: store demo value and hide errors
          try {
            localStorage.setItem("cibc_jira_key", val);
          } catch (err) {}
          hideInputError(group, jiraInput, jiraError);

          if (window.CIBC_UI?.toast)
            window.CIBC_UI.toast("JIRA key accepted", { duration: 1600 });
        });
      }
    }

    // API token input + Connect button
    const apiInput = inScope("#apiKey");
    const connectBtn = inScope("#connectBtn");

    if (apiInput && connectBtn) {
      // find wrapper column to append error below input-row
      let column =
        apiInput.closest(".input-row")?.parentElement ||
        apiInput.closest(".sidebar") ||
        apiInput.closest("aside") ||
        apiInput.closest("section") ||
        document.body;
      const apiError = ensureErrorContainer(column, "apiError", "");

      // live hide on input
      apiInput.addEventListener("input", () => {
        const group = apiInput.closest(".input-group");
        if (apiInput.value && apiInput.value.trim() !== "") {
          hideInputError(group, apiInput, apiError);
        } else {
          // keep hidden until connect clicked; optional live error
          hideInputError(group, apiInput, apiError);
        }
      });

      connectBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const group = apiInput.closest(".input-group");
        const val = (apiInput.value || "").trim();
        if (!val) {
          showInputError(
            group,
            apiInput,
            apiError,
            "API token cannot be empty."
          );
          apiInput.focus();
          return;
        }

        // success: persist
        try {
          sessionStorage.setItem("cibc_api_token", val);
        } catch (err) {}

        hideInputError(group, apiInput, apiError);
        if (window.CIBC_UI?.toast)
          window.CIBC_UI.toast("API token saved (demo)", { duration: 1400 });
      });
    }
  } // end initValidation

  // init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initValidation);
  } else {
    initValidation();
  }

  // Expose helper for other scripts
  window.CIBCInputs = window.CIBCInputs || {};
  window.CIBCInputs.validateJira = function () {
    const inp = inScope("#jiraKey");
    if (!inp) return false;
    return /^[A-Za-z0-9_-]+$/.test(inp.value || "");
  };
})();
