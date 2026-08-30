"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const outputPath = path.join(root, "profile.config.js");
if (!fs.existsSync(envPath)) throw new Error("Missing .env. Copy .env.example to .env and fill in your values.");
const env = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#")).map((line) => {
  const separator = line.indexOf("=");
  return separator < 0 ? [line.trim(), ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}));
const keys = {
  fullName: "FULL_NAME", phone: "PHONE", email: "EMAIL", yearsOfExperience: "YEARS_OF_EXPERIENCE",
  currentCtc: "CURRENT_CTC", currentCtcLakhs: "CURRENT_CTC_LAKHS", expectedCtc: "EXPECTED_CTC",
  expectedCtcLakhs: "EXPECTED_CTC_LAKHS", location: "LOCATION", linkedinUrl: "LINKEDIN_URL",
  portfolioUrl: "PORTFOLIO_URL", coverLetter: "COVER_LETTER", noticePeriod: "NOTICE_PERIOD",
  additionalInfo: "ADDITIONAL_INFO", willingToRelocate: "WILLING_TO_RELOCATE",
  willingToCommute: "WILLING_TO_COMMUTE", authorizedToWork: "AUTHORIZED_TO_WORK",
  requireVisaSponsorship: "REQUIRE_VISA_SPONSORSHIP",
};
const profile = Object.fromEntries(Object.entries(keys).map(([key, envKey]) => [key, env[envKey] || ""]));
const aiConfig = {
  enabled: env.OLLAMA_ENABLED === "true",
  endpoint: env.OLLAMA_ENDPOINT || "",
  model: env.OLLAMA_MODEL || "",
  timeoutMs: Number(env.OLLAMA_TIMEOUT_MS) || 0,
};
const source = [
  `globalThis.AUTOAPPLY_PROFILE = Object.freeze(${JSON.stringify(profile, null, 2)});`,
  `globalThis.AUTOAPPLY_AI_CONFIG = Object.freeze(${JSON.stringify(aiConfig, null, 2)});`,
  "",
].join("\n");
fs.writeFileSync(outputPath, source, { mode: 0o600 });
console.log("Generated profile.config.js from .env");
