document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoApplyBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        alert("No active browser tab was found.");
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "autoApply" }, (response) => {
        if (chrome.runtime.lastError) {
          alert(
            "AutoApply could not be triggered. Please reload the LinkedIn job page and try again."
          );
        } else if (response && response.status === "started") {
          window.close();
        }
      });
    });
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.reload(tabs[0].id);
    });
  });

  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
