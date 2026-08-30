const DEFAULT_USER_DATA = {
  ...(globalThis.AUTOAPPLY_PROFILE || {}),
  yearsOfExperience: "4",
  autoSubmit: false,
  questions: [],
};

const FIELD_MAP = [
  "fullName", "phone", "email", "yearsOfExperience",
  "currentCtc", "currentCtcLakhs", "expectedCtc", "expectedCtcLakhs",
  "location", "linkedinUrl", "portfolioUrl", "coverLetter",
  "noticePeriod", "additionalInfo",
  "willingToRelocate", "willingToCommute", "authorizedToWork", "requireVisaSponsorship",
  "autoSubmit",
];

let questionsData = [];

function getQuestionTemplate(index, data) {
  const kws = (data && data.keywords) || "";
  const ans = (data && data.answer) || "";
  return `
    <div class="question-item" data-index="${index}">
      <div class="question-header">
        <span class="q-number">#${index + 1}</span>
        <button class="remove-btn" data-index="${index}" title="Remove this mapping">&times;</button>
      </div>
      <div class="form-row">
        <label>Keywords</label>
        <input type="text" class="q-keywords" value="${escapeHtml(kws)}" placeholder="e.g. current ctc, annual salary" />
        <div class="form-hint">Comma-separated keywords. All must match the question text.</div>
      </div>
      <div class="form-row">
        <label>Answer</label>
        <input type="text" class="q-answer" value="${escapeHtml(ans)}" placeholder="Enter the desired answer" />
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = questionsData
    .map((q, i) => getQuestionTemplate(i, q))
    .join("");

  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      questionsData.splice(idx, 1);
      renderQuestions();
    });
  });

  container.querySelectorAll(".q-keywords").forEach((input, i) => {
    input.addEventListener("input", () => {
      questionsData[i].keywords = input.value;
    });
  });
  container.querySelectorAll(".q-answer").forEach((input, i) => {
    input.addEventListener("input", () => {
      questionsData[i].answer = input.value;
    });
  });
}

function loadData() {
  chrome.storage.sync.get("userData", (result) => {
    const data = { ...DEFAULT_USER_DATA, ...(result.userData || {}) };
    data.yearsOfExperience = "4";
    for (const field of FIELD_MAP) {
      const el = document.getElementById(field);
      if (el && data[field] !== undefined) {
        if (el.type === "checkbox") el.checked = Boolean(data[field]);
        else el.value = data[field];
      }
    }
    questionsData = (data.questions && JSON.parse(JSON.stringify(data.questions))) || [];
    renderQuestions();
  });
}

function saveData() {
  const data = {};
  for (const field of FIELD_MAP) {
    const el = document.getElementById(field);
    if (el) data[field] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  data.questions = questionsData.map((q) => ({
    keywords: q.keywords || "",
    answer: q.answer || "",
  }));

  data.yearsOfExperience = "4";
  chrome.storage.sync.set({ userData: data }, () => {
    const status = document.getElementById("saveStatus");
    if (chrome.runtime.lastError) {
      status.textContent = "Error saving: " + chrome.runtime.lastError.message;
      status.className = "save-status show error";
    } else {
      status.textContent = "All settings saved successfully!";
      status.className = "save-status show success";
    }
    setTimeout(() => {
      status.className = "save-status";
    }, 3000);
  });
}

function loadDetectedFields() {
  const detectedDiv = document.getElementById("detectedFields");
  detectedDiv.innerHTML = "<p style='color:#888;font-size:0.9em'>Scanning LinkedIn page...</p>";

  chrome.tabs.query({ url: "https://www.linkedin.com/jobs/*" }, (tabs) => {
    const targetTab = tabs.find((tab) => tab.active) || tabs[0];
    if (!targetTab?.id) {
      detectedDiv.innerHTML = "<p style='color:#d93a3a;font-size:0.9em'>No LinkedIn Jobs tab found.</p>";
      return;
    }

    chrome.tabs.sendMessage(targetTab.id, { action: "getFieldsForQuestions" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.fields) {
        detectedDiv.innerHTML =
          "<p style='color:#d93a3a;font-size:0.9em'>Could not scan. Make sure you're on a LinkedIn job page with an open Easy Apply form.</p>";
        return;
      }

      const fields = response.fields;
      let html = "<p style='font-size:0.85em;color:#1a7f37;font-weight:500'>Detected " + fields.length + " field(s). Click to add as mapping:</p><div class='detected-fields'>";

      for (let i = 0; i < Math.min(fields.length, 30); i++) {
        const f = fields[i];
        const labelText = f.labels ? f.labels.join(" | ") : (f.placeholder || "unknown");
        const typeInfo = f.type === "radio" ? " [radio group]" : "";
        html += `<span class="tag" style="cursor:pointer" data-label="${escapeHtml(labelText)}" title="Click to add mapping">${escapeHtml(labelText.substring(0, 50))}${typeInfo}</span>`;
      }

      html += "</div>";
      detectedDiv.innerHTML = html;

      detectedDiv.querySelectorAll(".tag").forEach((tag) => {
        tag.addEventListener("click", () => {
          const label = tag.dataset.label;
          const exists = questionsData.some((q) => q.keywords === label);
          if (!exists) {
            questionsData.push({ keywords: label, answer: "" });
            renderQuestions();
            tag.style.opacity = "0.5";
            tag.title = "Already added";
          }
        });
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.getElementById("backBtn").addEventListener("click", (e) => {
    e.preventDefault();
    window.close();
  });

  document.getElementById("addQuestionBtn").addEventListener("click", () => {
    questionsData.push({ keywords: "", answer: "" });
    renderQuestions();
  });

  document.getElementById("saveBtn").addEventListener("click", saveData);

  document.getElementById("scanFieldsBtn").addEventListener("click", loadDetectedFields);
});
