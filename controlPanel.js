(() => {
  "use strict";
  const PANEL_ID = "autoapply-control-panel";
  function makeButton(label, background, color) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    Object.assign(button.style, { flex: "1", padding: "8px 12px", border: "1px solid #d0d7de", borderRadius: "6px", background, color, cursor: "pointer", fontWeight: "600" });
    return button;
  }
  function show() {
    const existing = document.getElementById(PANEL_ID); if (existing) { existing.hidden = false; return; }
    const panel = document.createElement("aside"); panel.id = PANEL_ID; panel.setAttribute("aria-label", "AutoApply controls");
    Object.assign(panel.style, { position: "fixed", top: "40px", right: "40px", zIndex: "2147483647", width: "280px", padding: "16px", border: "1px solid #d0d7de", borderRadius: "12px", background: "#fff", color: "#1f2328", boxShadow: "0 8px 28px rgba(0,0,0,.18)", font: "14px system-ui, sans-serif" });
    const header = document.createElement("div"); header.textContent = "AutoApply by Kendrashya Diwakar"; Object.assign(header.style, { fontWeight: "700", cursor: "move", paddingRight: "28px" });
    const status = document.createElement("p"); status.textContent = "AutoApply is running."; status.setAttribute("aria-live", "polite"); Object.assign(status.style, { margin: "10px 0", lineHeight: "1.4" });
    const actions = document.createElement("div"); Object.assign(actions.style, { display: "flex", gap: "8px" });
    const pause = makeButton("Pause", "#0a66c2", "#fff"); const stop = makeButton("Stop", "#fff", "#b42318"); const close = makeButton("×", "transparent", "#57606a");
    Object.assign(close.style, { position: "absolute", top: "8px", right: "8px", width: "32px", padding: "4px" });
    pause.addEventListener("click", () => { const engine = window.AutoApplyEngine; if (!engine) return; engine.getState().paused ? engine.resume() : engine.pause(); });
    stop.addEventListener("click", () => window.AutoApplyEngine?.stop()); close.addEventListener("click", () => { window.AutoApplyEngine?.stop(); panel.remove(); });
    actions.append(pause, stop); panel.append(header, close, status, actions); document.body.append(panel);
    let drag = null;
    header.addEventListener("pointerdown", (event) => { const rect = panel.getBoundingClientRect(); drag = { x: event.clientX - rect.left, y: event.clientY - rect.top }; header.setPointerCapture(event.pointerId); });
    header.addEventListener("pointermove", (event) => { if (!drag) return; panel.style.left = `${Math.max(0, event.clientX - drag.x)}px`; panel.style.top = `${Math.max(0, event.clientY - drag.y)}px`; panel.style.right = "auto"; });
    header.addEventListener("pointerup", () => { drag = null; });
    window.addEventListener("autoapply:status", (event) => { status.textContent = event.detail?.message || ""; pause.textContent = ["paused", "review", "attention"].includes(event.detail?.status) ? "Resume" : "Pause"; });
  }
  window.AutoApplyPanel = { show };
})();
