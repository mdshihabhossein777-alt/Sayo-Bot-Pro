"use strict";

// A small pool of current, plausible desktop Chrome versions to rotate
// through. A single frozen version shared by every process using this
// package is itself a fingerprint — thousands of unrelated accounts all
// claiming the exact same browser build is a trivially detectable pattern.
// Keep this list current; entries that are far behind Chrome's real release
// timeline are themselves a signal.
const CHROME_VERSIONS = [
  "131.0.6778.140",
  "132.0.6834.111",
  "133.0.6943.98",
  "134.0.6998.117",
  "135.0.7049.85"
];

function pickChromeVersion() {
  return CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];
}

function buildUserAgent(version) {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

// Chrome's Sec-Ch-Ua "GREASE" brand slot rotates through a small set of
// placeholder strings, picked deterministically from the major version.
function greaseForVersion(major) {
  const forms = ["Not)A;Brand", "Not A(Brand", "Not;A=Brand", "Not A Brand"];
  return forms[major % 4];
}

// Generated once per process and reused for every request this instance
// makes — a real browser's User-Agent never changes mid-session, so
// picking a fresh one per call (or letting different code paths fall back
// to different hardcoded defaults) is itself inconsistent and detectable.
let cachedFingerprint = null;

function getFingerprint() {
  if (!cachedFingerprint) {
    const version = pickChromeVersion();
    const major = parseInt(version.split(".")[0], 10);
    cachedFingerprint = {
      userAgent: buildUserAgent(version),
      version,
      major
    };
  }
  return cachedFingerprint;
}

function getDefaultUserAgent() {
  return getFingerprint().userAgent;
}

// Derives Sec-Ch-Ua client hints from whatever User-Agent is actually in
// use, instead of a hardcoded version — so hints never contradict the UA
// string on the same request (a mismatch there is a trivial server-side
// check for Facebook to run).
function clientHintsFromUA(ua) {
  const s = String(ua || getDefaultUserAgent());
  const chromeMatch = s.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  const major = chromeMatch ? chromeMatch[1] : String(getFingerprint().major);
  const full = chromeMatch ? chromeMatch[0].split("/")[1] : getFingerprint().version;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(s);

  let platform = "Windows";
  let platformVersion = "\"15.0.0\"";
  if (/Android\s*(\d+)/i.test(s)) {
    platform = "Android";
    platformVersion = `"${s.match(/Android\s*(\d+(?:\.\d+)?)/i)[1]}.0"`;
  } else if (/iPhone|iPad/i.test(s)) {
    platform = "iOS";
    platformVersion = "\"17.0.0\"";
  } else if (/Mac OS X/i.test(s)) {
    platform = "macOS";
    platformVersion = "\"14.0.0\"";
  } else if (/Linux/i.test(s) && !/Android/i.test(s)) {
    platform = "Linux";
    platformVersion = "\"\"";
  }

  const grease = greaseForVersion(parseInt(major, 10));
  const hints = {
    "sec-ch-ua": `"Chromium";v="${major}", "${grease}";v="24", "Google Chrome";v="${major}"`,
    "sec-ch-ua-mobile": isMobile ? "?1" : "?0",
    "sec-ch-ua-platform": `"${platform}"`,
    "sec-ch-ua-full-version-list": `"Chromium";v="${full}", "${grease}";v="24.0.0.0", "Google Chrome";v="${full}"`,
    "sec-ch-ua-platform-version": platformVersion
  };
  if (!isMobile) {
    hints["sec-ch-ua-arch"] = "\"x86\"";
    hints["sec-ch-ua-bitness"] = "\"64\"";
  }
  return hints;
}

module.exports = {
  getDefaultUserAgent,
  getFingerprint,
  clientHintsFromUA
};
