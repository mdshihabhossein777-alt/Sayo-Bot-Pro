"use strict";

// Cookie helpers extracted from client.js

function saveCookies(jar) {
  return res => {
    try {
      const setCookie = res?.headers?.["set-cookie"];
      if (Array.isArray(setCookie) && setCookie.length) {
        const url =
          res?.request?.res?.responseUrl ||
          (res?.config?.baseURL
            ? new URL(res.config.url || "/", res.config.baseURL).toString()
            : res?.config?.url || "https://www.facebook.com");
        for (const c of setCookie) {
          try {
            jar.setCookieSync(c, url);
          } catch {
            // ignore per-cookie errors
          }
          // Mirror facebook.com <-> messenger.com so a session refresh that
          // only touches one domain's Set-Cookie doesn't leave the other
          // domain holding a stale cookie. Requests to messenger.com (e.g.
          // the periodic session-keeper ping) otherwise end up looking
          // logged-out even while the facebook.com session is fine, which
          // is itself an inconsistency Facebook's detection can key off.
          try {
            if (/domain=\.?facebook\.com/i.test(c)) {
              const mirrored = c.replace(/domain=\.?facebook\.com/i, "domain=.messenger.com");
              jar.setCookieSync(mirrored, "https://www.messenger.com");
            } else if (/domain=\.?messenger\.com/i.test(c)) {
              const mirrored = c.replace(/domain=\.?messenger\.com/i, "domain=.facebook.com");
              jar.setCookieSync(mirrored, "https://www.facebook.com");
            }
          } catch {
            // ignore per-cookie mirroring errors
          }
        }
      }
    } catch {
      // ignore unexpected cookie parsing errors
    }
    return res;
  };
}

function getAppState(jar) {
  if (!jar || typeof jar.getCookiesSync !== "function") return [];
  const urls = ["https://www.facebook.com"];
  const all = urls.flatMap(u => {
    try {
      return jar.getCookiesSync(u) || [];
    } catch {
      return [];
    }
  });
  const seen = new Set();
  const out = [];
  for (const c of all) {
    const key = c.key || c.name;
    if (!key) continue;
    const id = key + "|" + (c.domain || "") + "|" + (c.path || "/");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      key,
      value: c.value,
      domain: c.domain || ".facebook.com",
      path: c.path || "/",
      hostOnly: !!c.hostOnly,
      creation: c.creation || new Date(),
      lastAccessed: c.lastAccessed || new Date(),
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      expires: c.expires && c.expires !== "Infinity" ? c.expires : "Infinity"
    });
  }
  return out;
}

module.exports = {
  saveCookies,
  getAppState
};

