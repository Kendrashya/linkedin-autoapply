(() => {
  "use strict";
  const DEFAULTS = Object.freeze({
    ...(globalThis.AUTOAPPLY_PROFILE || {}), yearsOfExperience: "4", questions: [], autoSubmit: false,
  });
  const SELECTORS = Object.freeze({
    modal: ".jobs-easy-apply-modal, .artdeco-modal[role='dialog'], .job-details-apply-form",
    easyApply: "button.jobs-apply-button",
    next: "button[data-easy-apply-next-button], button[data-live-test-easy-apply-next-button]",
    review: "button[data-live-test-easy-apply-review-button], button[aria-label*='Review']",
    submit: "button[data-live-test-easy-apply-submit-button], button[aria-label*='Submit application'], button[data-control-name='submit_unify']",
    done: "button[aria-label='Done'], button[data-control-name='done']",
    fields: "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select, [role='combobox'], button[aria-haspopup='listbox']",
  });
  const state = { running: false, paused: false, busy: false, timer: null, userData: null };
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = (element) => Boolean(element?.isConnected && element.getClientRects().length);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function queryVisible(selector, root = document) {
    return Array.from(root.querySelectorAll(selector)).find((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true") || null;
  }
  function associatedLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (label) return label;
    }
    return field.closest("label");
  }
  function actionable(field) {
    return visible(field) || ((field.type === "radio" || field.type === "checkbox") && visible(associatedLabel(field)));
  }
  function labelTexts(field) {
    const values = [];
    const add = (value) => { const text = String(value || "").replace(/\s+/g, " ").trim(); if (text) values.push(text); };
    if (field.id) document.querySelectorAll(`label[for="${CSS.escape(field.id)}"]`).forEach((label) => add(label.textContent));
    add(field.getAttribute("aria-label")); add(field.getAttribute("placeholder")); add(field.name); add(field.closest("label")?.textContent);
    const group = field.closest("fieldset, .jobs-easy-apply-form-element, .fb-dash-form-element, .artdeco-form-item");
    add(group?.querySelector("legend, label, .artdeco-combobox__label, .fb-dash-form-element__label")?.textContent);
    return [...new Set(values)];
  }
  function optionLabel(field) {
    return associatedLabel(field)?.textContent.trim() || field.value || "";
  }
  function groupFields(field, root) {
    if (!field.name) return [field];
    return Array.from(root.querySelectorAll(`input[type="${field.type}"]`)).filter((item) => item.name === field.name);
  }
  function customAnswer(text, mappings) {
    for (const item of Array.isArray(mappings) ? mappings : []) {
      const terms = normalize(item?.keywords).split(",").map(normalize).filter(Boolean);
      if (terms.length && terms.every((term) => text.includes(term))) return String(item.answer || "").trim();
    }
    return "";
  }
  function knownAnswer(question, data) {
    const text = normalize(question);
    if (/\b(?:year|years|yr|yrs)\b/.test(text) && /\b(?:work|working|experience|professional)\b/.test(text)) return "4";
    const mapped = customAnswer(text, data.questions); if (mapped) return mapped;
    const any = (...terms) => terms.some((term) => text.includes(term));
    const expected = any("expected", "desired"); const money = any("ctc", "salary", "compensation", "package"); const lakhs = any("lakh", "lacs", "lpa");
    if (money) return data[expected ? (lakhs ? "expectedCtcLakhs" : "expectedCtc") : (lakhs ? "currentCtcLakhs" : "currentCtc")] || "";
    const rules = [
      [["phone", "mobile", "telephone", "contact number"], "phone"], [["email", "e-mail"], "email"],
      [["full name", "your name"], "fullName"], [["years of experience", "year of experience", "total experience"], "yearsOfExperience"],
      [["linkedin"], "linkedinUrl"], [["github"], "githubUrl"], [["portfolio", "personal website", "website url"], "portfolioUrl"],
      [["notice period"], "noticePeriod"], [["current location", "city", "where are you located"], "location"],
      [["cover letter"], "coverLetter"], [["additional information"], "additionalInfo"],
      [["relocate", "relocation"], "willingToRelocate"], [["commute"], "willingToCommute"],
      [["sponsor", "sponsorship", "visa support"], "requireVisaSponsorship"], [["authorized to work", "work authorization", "legally authorized"], "authorizedToWork"],
    ];
    for (const [terms, key] of rules) if (terms.some((term) => text.includes(term))) return data[key] || "";
    return "";
  }
  function nativeValue(field, value) {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(field, value); else field.value = value;
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  function findMatchingOption(options, answer) {
    const target = normalize(answer); if (!target) return null;
    return options.find((item) => normalize(item.label) === target || normalize(item.value) === target)
      || options.find((item) => normalize(item.label).includes(target) || target.includes(normalize(item.label)));
  }
  function selectNative(field, answer) {
    const options = Array.from(field.options).filter((option) => option.value).map((option) => ({ element: option, label: option.textContent.trim(), value: option.value }));
    const match = findMatchingOption(options, answer); if (!match) return false;
    field.value = match.value; field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })); return true;
  }
  async function comboboxOptions(field) {
    if (field.list) return Array.from(field.list.options).map((option) => ({ element: option, label: option.label || option.value, value: option.value }));
    field.focus(); field.click(); await wait(250);
    const controlled = field.getAttribute("aria-controls");
    const root = controlled ? document.getElementById(controlled) : document;
    const options = Array.from((root || document).querySelectorAll("[role='option'], .artdeco-typeahead__result, li[aria-label]"))
      .filter(visible).map((element) => ({ element, label: element.textContent.trim() || element.getAttribute("aria-label") || "", value: element.getAttribute("data-value") || element.textContent.trim() }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return options;
  }
  async function selectCombobox(field, answer) {
    field.focus();
    if (field instanceof HTMLInputElement) { nativeValue(field, answer); await wait(150); }
    const options = await comboboxOptions(field); const match = findMatchingOption(options, answer);
    if (match) { match.element.scrollIntoView({ block: "nearest" }); match.element.click(); return true; }
    if (field instanceof HTMLInputElement) {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      return Boolean(field.value.trim());
    }
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  }
  async function describeFields(root) {
    const descriptors = []; const seenGroups = new Set(); let counter = 0;
    for (const field of root.querySelectorAll(SELECTORS.fields)) {
      if (!actionable(field) || field.disabled || field.readOnly || isSatisfied(field, root)) continue;
      const question = labelTexts(field).join(" | "); if (!question) continue;
      const id = `field-${counter++}`; let type = field.type || field.getAttribute("role") || field.tagName.toLowerCase(); let options = [];
      if (type === "radio") {
        const key = field.name || question; if (seenGroups.has(`radio:${key}`)) continue; seenGroups.add(`radio:${key}`);
        options = groupFields(field, root).map((item) => optionLabel(item));
      } else if (type === "checkbox") {
        options = ["true", "false"];
      } else if (field instanceof HTMLSelectElement) {
        type = "select"; options = Array.from(field.options).filter((option) => option.value).map((option) => option.textContent.trim());
      } else if (field.getAttribute("role") === "combobox" || field.getAttribute("aria-haspopup") === "listbox" || field.getAttribute("aria-autocomplete") || field.list) {
        type = "combobox"; options = (await comboboxOptions(field)).map((item) => item.label).filter(Boolean);
      }
      descriptors.push({ id, field, question, type, options });
    }
    return descriptors;
  }
  function isSatisfied(field, root) {
    if (field.type === "radio") return groupFields(field, root).some((item) => item.checked);
    if (field.type === "checkbox") return field.checked;
    if (field instanceof HTMLSelectElement) {
      const selected = field.selectedOptions[0];
      return Boolean(selected && selected.value && !selected.disabled && !/select|choose/i.test(selected.textContent));
    }
    if (field.getAttribute("role") === "combobox" || field.getAttribute("aria-haspopup") === "listbox") {
      const value = String(field.value ?? field.textContent ?? "").trim();
      return Boolean(value && !/select|choose/i.test(value));
    }
    return Boolean(String(field.value ?? field.textContent ?? "").trim());
  }
  async function applyAnswer(descriptor, answer, root) {
    const value = String(answer || "").trim(); if (!value) return false;
    const { field, type } = descriptor;
    if (type === "select") return selectNative(field, value);
    if (type === "combobox") return selectCombobox(field, value);
    if (type === "radio") {
      const options = groupFields(field, root).map((item) => ({ element: item, label: optionLabel(item), value: item.value }));
      const match = findMatchingOption(options, value);
      if (match) {
        const target = associatedLabel(match.element) || match.element;
        target.scrollIntoView({ block: "nearest" }); target.click();
        if (!match.element.checked) match.element.click();
        match.element.dispatchEvent(new Event("change", { bubbles: true }));
        return match.element.checked;
      }
      return false;
    }
    if (type === "checkbox") {
      if (["true", "yes", "checked", "agree"].includes(normalize(value))) {
        const target = associatedLabel(field) || field; target.scrollIntoView({ block: "nearest" });
        if (!field.checked) target.click(); if (!field.checked) field.click();
        field.dispatchEvent(new Event("change", { bubbles: true })); return field.checked;
      }
      return false;
    }
    nativeValue(field, value); return Boolean(field.value);
  }
  async function fillForm(root, data) {
    const descriptors = await describeFields(root);
    for (const descriptor of descriptors) {
      const known = knownAnswer(descriptor.question, data);
      if (known) await applyAnswer(descriptor, known, root);
    }
  }
  function hasBlockingFields(root) {
    if (queryVisible(".artdeco-inline-feedback--error, [aria-invalid='true']", root)) return true;
    return Array.from(root.querySelectorAll("input[required], textarea[required], select[required], [aria-required='true']")).some((field) => visible(field) && !field.disabled && !isSatisfied(field, root));
  }
  function notify(status, message) { window.dispatchEvent(new CustomEvent("autoapply:status", { detail: { status, message } })); }
  function click(element) { if (!element) return false; element.click(); return true; }
  async function tick() {
    if (!state.running || state.paused || state.busy) return; state.busy = true;
    try {
      const modal = queryVisible(SELECTORS.modal);
      if (!modal) { if (!click(queryVisible(SELECTORS.easyApply))) notify("waiting", "Open an Easy Apply job to begin."); return; }
      await fillForm(modal, state.userData);
      if (hasBlockingFields(modal)) { notify("attention", "Some required fields still need an answer."); return; }
      const submit = queryVisible(SELECTORS.submit, modal);
      if (submit) {
        if (!state.userData.autoSubmit) { state.paused = true; notify("review", "Application is ready for review and submission."); return; }
        click(submit); notify("submitting", "Submitting application…"); return;
      }
      if (click(queryVisible(SELECTORS.review, modal)) || click(queryVisible(SELECTORS.next, modal))) { await wait(900); return; }
      const done = queryVisible(SELECTORS.done, modal); if (done) { click(done); stop("Application flow finished."); }
    } catch (error) { notify("attention", error.message || "Form filling failed."); }
    finally { state.busy = false; }
  }
  function start(userData) {
    state.userData = { ...DEFAULTS, ...(userData || {}), yearsOfExperience: "4" }; state.running = true; state.paused = false;
    clearInterval(state.timer); state.timer = setInterval(tick, 1500); window.AutoApplyPanel?.show?.(); notify("running", "AutoApply is running."); tick();
  }
  function stop(message = "AutoApply stopped.") { state.running = false; state.paused = false; clearInterval(state.timer); state.timer = null; notify("stopped", message); }
  window.AutoApplyEngine = { pause() { state.paused = true; notify("paused", "AutoApply paused."); }, resume() { if (state.running) { state.paused = false; notify("running", "AutoApply resumed."); tick(); } }, stop, getState() { return { running: state.running, paused: state.paused }; } };
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === "autoApply") { chrome.storage.sync.get({ userData: DEFAULTS }, ({ userData }) => start(userData)); sendResponse({ status: "started" }); return false; }
    if (request?.action === "getFieldsForQuestions") { describeFields(queryVisible(SELECTORS.modal) || document).then((items) => sendResponse({ fields: items.map(({ field, ...item }) => item) })); return true; }
    return false;
  });
})();
