"use strict";

// Multi-pattern fb_dtsg / jazoest extractor.
// Facebook serves the token in different shapes depending on surface, A/B
// bucket and login state (DTSGInitialData / DTSGInitData blobs, escaped JSON
// inside <script>, plain hidden inputs, async_get_token, ...). Matching only
// one shape is why refreshes intermittently fail with "Could not find
// fb_dtsg in HTML". Pattern order is first-match-wins.

const DTSG_PATTERNS = [
  /\["DTSGInitialData",\[\],\{"token":"([^"]+)"\}\]/,
  /\["DTSGInitData",\[\],\{"token":"([^"]+)"/,
  /"DTSGInitData",\[\],\{"token":"([^"]+)"/,
  /"dtsg":\{"token":"([^"]+)"/,
  /\{\\"token\\":\\"([^\\]+)\\"/,
  /,\{"token":"([^"]+)"\},\d+\]/,
  /"async_get_token":"([^"]+)"/,
  /name="fb_dtsg"\s+value="([^"]+)"/,
];

const JAZOEST_PATTERNS = [
  /name="jazoest"\s+value="([^"]+)"/,
  /jazoest=(\d+)/,
  /"jazoest":"?(\d+)"?/,
];

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return m[1];
  }
  return null;
}

function extractDtsg(html) {
  if (!html) return { fb_dtsg: null, jazoest: null };
  const raw = String(html);
  return {
    fb_dtsg: firstMatch(raw, DTSG_PATTERNS),
    jazoest: firstMatch(raw, JAZOEST_PATTERNS),
  };
}

module.exports = { extractDtsg, DTSG_PATTERNS, JAZOEST_PATTERNS };
