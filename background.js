"use strict";

importScripts("profile.config.js");

const AI_DEFAULTS = Object.freeze({ ...(globalThis.AUTOAPPLY_AI_CONFIG || {}) });

const RESUME_PROFILE = Object.freeze({ ...(globalThis.AUTOAPPLY_PROFILE || {}), yearsOfExperience: "4" });

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["id", "value", "confidence"],
      },
    },
  },
  required: ["answers"],
};

function storageGet(area, defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].get(defaults, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(result);
    });
  });
}

function storageSet(area, value) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve();
    });
  });
}

async function initialize() {
  const [{ aiConfig, userData }, { resumeText }] = await Promise.all([
    storageGet("sync", { aiConfig: null, userData: {} }),
    storageGet("local", { resumeText: "" }),
  ]);
  const profile = { ...(userData || {}) };
  for (const [key, value] of Object.entries(RESUME_PROFILE)) if (!profile[key]) profile[key] = value;
  const mergedConfig = { ...AI_DEFAULTS, ...(aiConfig || {}) };
  if (mergedConfig.timeoutMs === 45000) mergedConfig.timeoutMs = AI_DEFAULTS.timeoutMs;
  await storageSet("sync", { aiConfig: mergedConfig, userData: profile });
  if (resumeText) await storageSet("local", { resumeText: "" });
}

chrome.runtime.onInstalled.addListener(() => {
  initialize().catch((error) => console.error("AutoApply initialization failed:", error));
});

function normalizeEndpoint(value) {
  const url = new URL(value || AI_DEFAULTS.endpoint);
  const allowed = new Set(["localhost", "127.0.0.1"]);
  if (url.protocol !== "http:" || !allowed.has(url.hostname)) {
    throw new Error("Ollama endpoint must be a local HTTP address.");
  }
  return url.origin;
}

function parseJsonResponse(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

function buildPrompt(resumeText, profile, fields) {
  return [
    "You fill job application fields using only the candidate data supplied below.",
    "Return one answer per field when the resume/profile supports it.",
    "For select, radio, checkbox, and combobox fields, value MUST exactly equal one supplied option.",
    "For checkbox fields use the option value 'true' or 'false'.",
    "For numeric fields return digits only unless the question explicitly requests units.",
    "For free-text motivation questions, write a truthful, concise response grounded in the resume.",
    "Never invent degrees, dates, employers, skills, authorization, demographics, or personal facts.",
    "If unsupported or ambiguous, return an empty value with confidence 0.",
    `PROFILE SETTINGS:\n${JSON.stringify(profile)}`,
    `RESUME:\n${resumeText}`,
    `FIELDS:\n${JSON.stringify(fields)}`,
  ].join("\n\n");
}

async function queryOllama(fields) {
  const [{ aiConfig, userData }, { resumeText }, { aiAnswerCache }] = await Promise.all([
    storageGet("sync", { aiConfig: AI_DEFAULTS, userData: {} }),
    storageGet("local", { resumeText: "" }),
    storageGet("local", { aiAnswerCache: {} }),
  ]);
  const config = { ...AI_DEFAULTS, ...(aiConfig || {}) };
  if (!config.enabled) throw new Error("Ollama answering is disabled in settings.");
  const endpoint = normalizeEndpoint(config.endpoint);
  const cache = aiAnswerCache || {};
  const pending = [];
  const answers = [];
  for (const field of fields) {
    const key = JSON.stringify([field.question, field.type, field.options]);
    if (cache[key]) answers.push({ ...cache[key], id: field.id });
    else pending.push({ ...field, cacheKey: key });
  }
  if (!pending.length) return answers;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(config.timeoutMs) || AI_DEFAULTS.timeoutMs));
  let response;
  try {
    response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        keep_alive: "10m",
        format: ANSWER_SCHEMA,
        options: { temperature: 0.1, num_predict: 256 },
        messages: [{ role: "user", content: buildPrompt(resumeText, userData || {}, pending.map(({ cacheKey, ...field }) => field)) }],
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Ollama timed out after ${Math.round(config.timeoutMs / 1000)} seconds. Increase the timeout or warm the model from Settings.`);
    throw new Error(`Cannot reach Ollama at ${endpoint}. Start Ollama and check the endpoint.`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${detail.slice(0, 240)}`);
  }
  const payload = await response.json();
  const parsed = parseJsonResponse(payload.message?.content || payload.response);
  const byId = new Map((parsed.answers || []).map((answer) => [String(answer.id), answer]));
  for (const field of pending) {
    const answer = byId.get(String(field.id));
    if (!answer || typeof answer.value !== "string") continue;
    const safe = { value: answer.value.trim(), confidence: Number(answer.confidence) || 0 };
    answers.push({ id: field.id, ...safe });
    if (safe.value && safe.confidence >= 0.75) cache[field.cacheKey] = safe;
  }
  await storageSet("local", { aiAnswerCache: cache });
  return answers;
}

async function testOllama() {
  const { aiConfig } = await storageGet("sync", { aiConfig: AI_DEFAULTS });
  const config = { ...AI_DEFAULTS, ...(aiConfig || {}) };
  const endpoint = normalizeEndpoint(config.endpoint);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(config.timeoutMs) || AI_DEFAULTS.timeoutMs));
  let response;
  try {
    response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: config.model, stream: false, keep_alive: "10m", options: { temperature: 0, num_predict: 2 }, messages: [{ role: "user", content: "Reply only: OK" }] }),
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Gemma did not respond within ${Math.round(config.timeoutMs / 1000)} seconds.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  return { model: data.model || config.model, elapsedSeconds: Math.round((Date.now() - started) / 1000), reply: data.message?.content || "" };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === "ollama:answer") {
    queryOllama(Array.isArray(request.fields) ? request.fields.slice(0, 30) : [])
      .then((answers) => sendResponse({ ok: true, answers }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.action === "ollama:test") {
    testOllama().then((result) => sendResponse({ ok: true, ...result })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
