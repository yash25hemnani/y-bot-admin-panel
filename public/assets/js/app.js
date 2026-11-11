// Y-Bot console behaviours.
// Loaded with `defer`. No inline handlers anywhere, so helmet's default CSP stays intact.
// Each behaviour is opt-in through a data attribute.

(() => {
  "use strict";

  const announce = (() => {
    let region;
    return (message) => {
      if (!region) {
        region = document.createElement("div");
        region.className = "visually-hidden";
        region.setAttribute("role", "status");
        region.setAttribute("aria-live", "polite");
        document.body.append(region);
      }
      region.textContent = "";
      requestAnimationFrame(() => (region.textContent = message));
    };
  })();

  // Disclosure: <button data-toggle="target-id" aria-expanded="false">
  // Used for the mobile nav and the user menu. Escape and outside clicks close it.
  const openToggles = new Set();

  const setOpen = (button, open) => {
    const target = document.getElementById(button.dataset.toggle);
    if (!target) return;
    button.setAttribute("aria-expanded", String(open));
    target.toggleAttribute("data-open", open);
    open ? openToggles.add(button) : openToggles.delete(button);
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle]");
    if (button) {
      setOpen(button, button.getAttribute("aria-expanded") !== "true");
      return;
    }
    for (const open of openToggles) {
      const target = document.getElementById(open.dataset.toggle);
      if (target && !target.contains(event.target)) setOpen(open, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || openToggles.size === 0) return;
    for (const open of openToggles) {
      setOpen(open, false);
      open.focus();
    }
  });

  // Copy: <button data-copy="value"> or <button data-copy-from="element-id">
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy], [data-copy-from]");
    if (!button) return;
    const source = button.dataset.copyFrom && document.getElementById(button.dataset.copyFrom);
    const value = source ? source.textContent.trim() : button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      button.setAttribute("data-copied", "");
      announce("Copied to clipboard");
      setTimeout(() => button.removeAttribute("data-copied"), 1600);
    } catch {
      announce("Couldn't copy. Select the text and copy it manually.");
    }
  });

  // Show / hide password: <button data-reveal="input-id" aria-pressed="false">
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reveal]");
    if (!button) return;
    const input = document.getElementById(button.dataset.reveal);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  // Confirm destructive actions: <form data-confirm="Revoke ESP32-07?">
  // Switches: <form class="switch-form"> with a <button role="switch"> inside.
  // After any confirm, the switch slides to its new position first, then the form posts,
  // so the motion shows what is about to change.
  const SWITCH_MS = 220;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
      event.preventDefault();
      return;
    }
    const toggle = form.querySelector('[role="switch"]');
    if (!toggle || form.dataset.sending) return;

    event.preventDefault();
    form.dataset.sending = "true";
    toggle.setAttribute("aria-checked", String(toggle.getAttribute("aria-checked") !== "true"));
    setTimeout(() => form.submit(), reducedMotion.matches ? 0 : SWITCH_MS + 60);
  });
})();
