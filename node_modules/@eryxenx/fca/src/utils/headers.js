"use strict";

// Sanitize header value to remove invalid characters
function sanitizeHeaderValue(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Remove array-like strings (e.g., "["performAutoLogin"]")
  // This handles cases where arrays were accidentally stringified
  if (str.trim().startsWith("[") && str.trim().endsWith("]")) {
    // Try to detect if it's a stringified array and remove it
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        // If it's an array, return empty string (invalid header value)
        return "";
      }
    } catch {
      // Not valid JSON, continue with normal sanitization
    }
  }

  // Remove invalid characters for HTTP headers:
  // - Control characters (0x00-0x1F, except HTAB 0x09)
  // - DEL character (0x7F)
  // - Newlines and carriage returns
  // - Square brackets (often indicate array stringification issues)
  str = str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F\r\n\[\]]/g, "").trim();

  return str;
}

// Sanitize header name to ensure it's valid
function sanitizeHeaderName(name) {
  if (!name || typeof name !== "string") return "";
  // Remove invalid characters for HTTP header names
  return name.replace(/[^\x21-\x7E]/g, "").trim();
}

const { getDefaultUserAgent, clientHintsFromUA } = require("./fingerprint");

function getHeaders(url, options, ctx, customHeader) {
  const u = new URL(url);
  const ua = options?.userAgent || getDefaultUserAgent();
  const referer = options?.referer || "https://www.facebook.com/";
  const origin = referer.replace(/\/+$/, "");
  const contentType = options?.contentType || "application/x-www-form-urlencoded";
  const acceptLang = options?.acceptLanguage || "en-US,en;q=0.9,vi;q=0.8";
  // NOTE: keep the && chain parenthesized — `||` binds looser than `&&`.
  const isNavigation = (u.pathname === "/" &&
    !url.includes("ajax") &&
    !url.includes("graphql") &&
    !u.pathname.includes("api") &&
    !url.includes("chat")) ||
    url.includes("checkpoint");
  const acceptHeader = isNavigation
    ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
    : "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7";
  const headers = {
    Host: sanitizeHeaderValue(u.host),
    Origin: sanitizeHeaderValue(origin),
    Referer: sanitizeHeaderValue(referer),
    "User-Agent": sanitizeHeaderValue(ua),
    Accept: acceptHeader,
    "Accept-Language": sanitizeHeaderValue(acceptLang),
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": sanitizeHeaderValue(contentType),
    Connection: "keep-alive",
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    ...clientHintsFromUA(ua),
    "Sec-Fetch-Site": isNavigation ? "none" : "same-origin",
    "Sec-Fetch-Mode": isNavigation ? "navigate" : "cors",
    "Sec-Fetch-Dest": isNavigation ? "document" : "empty",
    Pragma: "no-cache",
    "Cache-Control": "no-cache"
  };
  if (isNavigation) {
    headers["Sec-Fetch-User"] = "?1";
  } else {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }
  if (ctx?.region) {
    const regionValue = sanitizeHeaderValue(ctx.region);
    if (regionValue) headers["X-MSGR-Region"] = regionValue;
  }
  if (customHeader && typeof customHeader === "object") {
    // Filter customHeader to only include valid HTTP header values (strings, numbers, booleans)
    // Exclude functions, objects, arrays, and other non-serializable values
    for (const [key, value] of Object.entries(customHeader)) {
      // Skip null, undefined, functions, objects, and arrays
      if (value === null || value === undefined || typeof value === "function") {
        continue;
      }
      if (typeof value === "object") {
        // Arrays are objects in JavaScript, so check for arrays explicitly
        if (Array.isArray(value)) {
          continue;
        }
        // Skip plain objects (but allow null which is already handled above)
        continue;
      }
      // Only allow strings, numbers, and booleans - convert to string and sanitize
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const sanitizedKey = sanitizeHeaderName(key);
        const sanitizedValue = sanitizeHeaderValue(value);
        if (sanitizedKey && sanitizedValue !== "") {
          headers[sanitizedKey] = sanitizedValue;
        }
      }
    }
  }
  // Final pass: sanitize all header values to ensure no invalid characters
  const sanitizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    const sanitizedKey = sanitizeHeaderName(key);
    const sanitizedValue = sanitizeHeaderValue(value);
    if (sanitizedKey && sanitizedValue !== "") {
      sanitizedHeaders[sanitizedKey] = sanitizedValue;
    }
  }
  return sanitizedHeaders;
}

module.exports = { getHeaders };
