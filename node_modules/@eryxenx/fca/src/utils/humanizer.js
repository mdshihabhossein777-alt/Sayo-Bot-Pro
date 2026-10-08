"use strict";

const DEFAULT_OPTIONS = Object.freeze({
  enabled: true,
  reactDelayMs: [2000, 3000],
  cooldownMs: 5500,
  resetMs: 10000,
  maxPerMinute: 20,
  commands: ["/", "!", "."],
  perThread: true
});

function isCommandLike(body, prefixes) {
  if (typeof body !== "string") return false;
  const text = body.trim();
  if (!text || !Array.isArray(prefixes) || !prefixes.length) return false;
  return prefixes.some(p => typeof p === "string" && p.length > 0 && text.startsWith(p));
}

function isNoPrefixAdminCommand(event) {
  try {
    const GoatBot = typeof global !== "undefined" ? global.GoatBot : undefined;
    if (!GoatBot || !GoatBot.config || !GoatBot.commands) return false;

    const cfg = GoatBot.config;
    if (!cfg.noPrefix || cfg.noPrefix.enable !== true) return false;
    if (!Array.isArray(cfg.adminBot) || !cfg.adminBot.includes(event.senderID)) return false;

    const body = typeof event.body === "string" ? event.body.trim() : "";
    if (!body) return false;

    const possibleCmd = body.split(/ +/)[0].toLowerCase();
    if (GoatBot.commands.has(possibleCmd)) return true;

    const alias = GoatBot.aliases && GoatBot.aliases.get(possibleCmd);
    return Boolean(alias && GoatBot.commands.has(alias));
  } catch {
    return false;
  }
}

function isGoatBotOnReplyTrigger(event) {
  try {
    const GoatBot = typeof global !== "undefined" ? global.GoatBot : undefined;
    if (!GoatBot || !GoatBot.onReply || !event.messageReply) return false;

    // Covers GoatBot's stateful "reply with a number" flows (setting.js,
    // and any other command using onReply) — these are plain-text replies
    // (e.g. "1", "2") with no prefix and no command-name match, so neither
    // isCommandLike nor the noPrefix/onChat checks above catch them.
    return GoatBot.onReply.has(event.messageReply.messageID);
  } catch {
    return false;
  }
}

function isGoatBotOnChatTrigger(event) {
  try {
    const GoatBot = typeof global !== "undefined" ? global.GoatBot : undefined;
    if (!GoatBot || !Array.isArray(GoatBot.onChat) || !GoatBot.onChat.length) return false;

    const body = typeof event.body === "string" ? event.body.trim().toLowerCase() : "";
    if (!body) return false;

    // onChat handlers commonly match on the full message text equal to a
    // command name (see prefix.js: body.toLowerCase() === "prefix"), so a
    // whole-body match against a registered onChat command name is the
    // best-effort, low-false-positive signal available here.
    return GoatBot.onChat.some(name => typeof name === "string" && name.toLowerCase() === body);
  } catch {
    return false;
  }
}

function randomBetween(min, max) {
  if (Array.isArray(min)) {
    const pair = min;
    min = pair[0];
    max = pair[1];
  }
  min = Number(min) || 0;
  max = Number(max) || min;
  if (max < min) { const t = min; min = max; max = t; }
  return min + Math.floor(Math.random() * (max - min + 1));
}

class CommandHumanizer {
  constructor(options) {
    this.setOptions(options);
    this._threads = new Map();
    this._global = { windowStart: 0, count: 0, accepted: 0, dropped: 0 };
    this._eventCount = 0;
  }

  setOptions(options) {
    const o = options || {};
    this.enabled = o.enabled !== false;
    this.reactDelayMs = o.reactDelayMs || DEFAULT_OPTIONS.reactDelayMs;
    this.cooldownMs = typeof o.cooldownMs === "number" ? o.cooldownMs : DEFAULT_OPTIONS.cooldownMs;
    this.resetMs = typeof o.resetMs === "number" ? o.resetMs : DEFAULT_OPTIONS.resetMs;
    this.maxPerMinute = typeof o.maxPerMinute === "number" ? o.maxPerMinute : DEFAULT_OPTIONS.maxPerMinute;
    this.prefixes = o.commands || o.prefixes || DEFAULT_OPTIONS.commands;
    this.perThread = o.perThread !== false;
    if (o.matcher !== undefined) {
      this.matcher = typeof o.matcher === "function" ? o.matcher : null;
    } else if (this.matcher === undefined) {
      this.matcher = null;
    }
  }

  setMatcher(fn) {
    this.matcher = typeof fn === "function" ? fn : null;
  }

  isCommand(event) {
    if (!event) return false;
    if (isCommandLike(event.body, this.prefixes)) return true;
    if (typeof this.matcher === "function") {
      try {
        if (this.matcher(event)) return true;
      } catch {
        // ignore matcher errors, fall through to built-in detection
      }
    }
    return isNoPrefixAdminCommand(event) || isGoatBotOnChatTrigger(event) || isGoatBotOnReplyTrigger(event);
  }

  _keyFor(event) {
    return this.perThread && event.threadID ? String(event.threadID) : "_global";
  }

  _globalAllowed() {
    const now = Date.now();
    if (now - this._global.windowStart >= 60000) {
      this._global.windowStart = now;
      this._global.count = 0;
    }
    if (this._global.count >= this.maxPerMinute) return false;
    this._global.count++;
    return true;
  }

  shouldProcess(event) {
    this._eventCount++;
    if (!this.enabled) return { ok: true, delayMs: 0 };

    const key = this._keyFor(event);
    const now = Date.now();

    let st = this._threads.get(key);
    if (!st) {
      st = { acceptedAt: 0, coolUntil: 0, lastCmdAt: 0, accepted: 0, dropped: 0 };
      this._threads.set(key, st);
    }

    if (st.lastCmdAt > 0 && (now - st.lastCmdAt >= this.resetMs)) {
      st.acceptedAt = 0;
      st.coolUntil = 0;
    }
    st.lastCmdAt = now;

    if (st.coolUntil > 0 && now < st.coolUntil) {
      st.dropped++;
      this._global.dropped++;
      return { ok: false, delayMs: 0, reason: "cooldown" };
    }

    if (this.maxPerMinute > 0 && !this._globalAllowed()) {
      st.dropped++;
      this._global.dropped++;
      return { ok: false, delayMs: 0, reason: "global-cap" };
    }

    st.acceptedAt = now;
    st.coolUntil = now + this.cooldownMs;
    st.accepted++;
    this._global.accepted++;
    return { ok: true, delayMs: randomBetween(this.reactDelayMs) };
  }

  reset(key) {
    if (key === undefined) { this._threads.clear(); return; }
    this._threads.delete(String(key));
  }

  stats() {
    const threads = [];
    this._threads.forEach((st, k) => threads.push({ threadID: k, ...st }));
    return {
      enabled: this.enabled,
      global: { ...this._global },
      eventCount: this._eventCount,
      threads
    };
  }
}

function createCommandHumanizer(options) {
  return new CommandHumanizer(options);
}

function createHumanizerMiddleware(humanizer, logger, api) {
  const log = typeof logger === "function"
    ? (msg, level) => logger(msg, level || "info")
    : () => {};

  function typingWanted() {
    try {
      const GoatBot = typeof global !== "undefined" ? global.GoatBot : undefined;
      if (GoatBot && GoatBot.config) return GoatBot.config.enableTypingIndicator === true;
      return true;
    } catch {
      return true;
    }
  }

  return function commandHumanizerMiddleware(event, next) {
    if (!humanizer.isCommand(event)) { next(); return; }

    const decision = humanizer.shouldProcess(event);

    if (!decision.ok) {
      const snippet = typeof event.body === "string" ? event.body.slice(0, 40) : String(event.body || "");
      log(`Humanizer: dropped command "${snippet}" (${decision.reason})`, "warn");
      next(false);
      return;
    }

    const delay = Math.max(0, decision.delayMs || 0);
    if (delay <= 0) { next(); return; }

    const canType = api && typeof api.sendTypingIndicator === "function" && event.threadID && typingWanted();
    if (!canType) {
      setTimeout(() => next(), delay);
      return;
    }

    Promise.resolve(api.sendTypingIndicator(event.threadID, true)).catch(() => {});
    setTimeout(() => {
      Promise.resolve(api.sendTypingIndicator(event.threadID, false)).catch(() => {});
      next();
    }, delay);
  };
}

module.exports = {
  CommandHumanizer,
  createCommandHumanizer,
  createHumanizerMiddleware,
  randomBetween,
  isCommandLike,
  isNoPrefixAdminCommand,
  isGoatBotOnChatTrigger,
  isGoatBotOnReplyTrigger,
  DEFAULT_OPTIONS
};
