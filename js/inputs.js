// js/inputs.js
// Floating label handling with JIRA supporting has-value + focus float.

(function () {
  const PAGE_SCOPE = 'body[data-page="main"]';
  function inScope(selector) {
    return document.querySelector(`${PAGE_SCOPE} ${selector}`);
  }
  function allInScope(selector) {
    return Array.from(document.querySelectorAll(`${PAGE_SCOPE} ${selector}`));
  }

  function initGroup(g) {
    if (!g) return;
    const input = g.querySelector("input");
    const clearBtn = g.querySelector(".input-action");
    if (!input) return;

    // --- INITIAL STATE ---
    const val = (input.value || "").trim();

    // BOTH JIRA + API token now support .has-value
    if (val.length > 0) g.classList.add("has-value");
    else g.classList.remove("has-value");

    // --- EVENTS ---
    input.addEventListener("input", () => {
      const v = (input.value || "").trim();
      if (v.length > 0) g.classList.add("has-value");
      else g.classList.remove("has-value");
    });

    input.addEventListener("focus", () => {
      g.classList.add("focus");
    });

    input.addEventListener("blur", () => {
      g.classList.remove("focus");
    });

    // clear button logic
    if (clearBtn) {
      clearBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (input.value) {
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      });
    }
  }

  // init
  function initAll() {
    const groups = allInScope(".input-group");
    groups.forEach(initGroup);
  }

  const ro = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(".input-group")) initGroup(node);
        else
          node.querySelectorAll &&
            node.querySelectorAll(".input-group").forEach(initGroup);
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initAll();
      ro.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    initAll();
    ro.observe(document.body, { childList: true, subtree: true });
  }

  window.CIBCInputs = window.CIBCInputs || {};
  window.CIBCInputs.init = initAll;
})();
