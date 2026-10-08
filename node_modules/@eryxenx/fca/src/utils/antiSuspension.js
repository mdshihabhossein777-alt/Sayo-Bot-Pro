"use strict";

const log = {
    warn: (tag, msg) => console.warn(`[${tag}] ${msg}`),
    info: (tag, msg) => console.log(`[${tag}] ${msg}`)
};

// Phrases Facebook responses use when it thinks this account is being
// operated by a bot / script rather than a human. If any of these show up
// in a response body or an error message, we treat it as a signal that
// current traffic looks automated and should slow down / back off.
const SUSPICION_PHRASES = [
    "checkpoint",
    "automated behavior",
    "automated_behavior",
    "unusual activity",
    "unusual_activity",
    "suspicious activity",
    "action_required",
    "account_locked",
    "account locked",
    "account has been disabled",
    "account has been suspended",
    "account suspended",
    "account banned",
    "bot detected",
    "bot_detected",
    "not a human",
    "spam detected",
    "spam_detected",
    "looks like spam",
    "rate limited",
    "rate_limit",
    "too many requests",
    "too_many_requests",
    "temporarily blocked",
    "feature temporarily unavailable",
    "verify your account",
    "confirm your identity",
    "confirm it's you",
    "security check required",
    "policy violation",
    "action blocked",
    "you're blocked from"
];

/**
 * Tracks send volume and paces outbound traffic so it doesn't look like a
 * script firing messages as fast as the network allows. Three layers:
 *
 *  - Pacing: a small delay before every send, and a slightly larger one
 *    between consecutive sends to the same thread.
 *  - Volume caps: soft hourly/daily ceilings; a fresh login starts under a
 *    stricter "warmup" ceiling for a while before easing to the normal one.
 *  - Cooldown: if Facebook's response text matches a suspicion phrase (or
 *    a send throws an error containing one), sending gets throttled harder
 *    for a while instead of continuing at full speed.
 */
class SendPacer {
    constructor() {
        this.perThreadLastSendAt = new Map();
        this.threadSendCounts = new Map();

        this.startedAt = Date.now();
        this.warmupWindowMs = 15 * 60 * 1000;
        this.warmupHourlyCap = 40;
        this.normalHourlyCap = 350;
        this.dailyCap = 2500;

        this.hourWindowStart = Date.now();
        this.hourSendCount = 0;
        this.dayWindowStart = Date.now();
        this.daySendCount = 0;

        this.cooldown = {
            active: false,
            since: null,
            durationMs: 45 * 60 * 1000,
            strikes: 0,
            strikesToActivate: 2
        };

        this._gcTimer = setInterval(() => this._rollWindows(), 60 * 1000);
        if (this._gcTimer.unref) this._gcTimer.unref();
    }

    destroy() {
        if (this._gcTimer) clearInterval(this._gcTimer);
    }

    _rollWindows() {
        const now = Date.now();
        if (now - this.hourWindowStart >= 60 * 60 * 1000) {
            this.hourWindowStart = now;
            this.hourSendCount = 0;
        }
        if (now - this.dayWindowStart >= 24 * 60 * 60 * 1000) {
            this.dayWindowStart = now;
            this.daySendCount = 0;
        }
    }

    _inWarmup() {
        return (Date.now() - this.startedAt) < this.warmupWindowMs;
    }

    _hourlyCap() {
        return this._inWarmup() ? this.warmupHourlyCap : this.normalHourlyCap;
    }

    /** Records that a suspicious signal was seen; may activate the cooldown. */
    noteSuspicionSignal(source) {
        this.cooldown.strikes++;
        if (!this.cooldown.active && this.cooldown.strikes >= this.cooldown.strikesToActivate) {
            this.cooldown.active = true;
            this.cooldown.since = Date.now();
            log.warn("AntiSuspension", `Cooldown activated after repeated suspicion signals (last: ${source || "unknown"}). Backing off for ${(this.cooldown.durationMs / 60000).toFixed(0)} min.`);
        }
    }

    /** Same check, but scans free text (an API response body, an error message). */
    scanForSuspicion(text) {
        if (!text || typeof text !== "string") return false;
        const lower = text.toLowerCase();
        const hit = SUSPICION_PHRASES.find(p => lower.includes(p));
        if (hit) this.noteSuspicionSignal(hit);
        return !!hit;
    }

    /** Inspects a thrown error's message for suspicion phrases. */
    noteSendError(err) {
        const msg = (err && (err.message || err.error)) ? String(err.message || err.error) : "";
        this.scanForSuspicion(msg);
    }

    isCoolingDown() {
        if (!this.cooldown.active) return false;
        if (Date.now() - this.cooldown.since >= this.cooldown.durationMs) {
            this.cooldown.active = false;
            this.cooldown.strikes = 0;
            this.cooldown.since = null;
            return false;
        }
        return true;
    }

    /**
     * Call this right before every send. Resolves once it's safe to go —
     * may internally wait (pacing delay, volume backoff, cooldown backoff).
     * Never rejects; on any internal problem it just resolves immediately
     * rather than blocking a real message.
     */
    async waitForTurn(threadID) {
        try {
            this._rollWindows();

            if (this.isCoolingDown()) {
                await this._sleep(2000 + Math.random() * 3000);
            }

            const cap = this._hourlyCap();
            if (this.hourSendCount >= cap) {
                log.warn("AntiSuspension", `Hourly send cap reached (${this.hourSendCount}/${cap}${this._inWarmup() ? ", warmup" : ""}). Slowing down.`);
                await this._sleep(4000 + Math.random() * 4000);
            }
            if (this.daySendCount >= this.dailyCap) {
                log.warn("AntiSuspension", `Daily send cap reached (${this.daySendCount}/${this.dailyCap}). Slowing down.`);
                await this._sleep(4000 + Math.random() * 4000);
            }

            const key = String(threadID);
            const lastAt = this.perThreadLastSendAt.get(key) || 0;
            const sinceLast = Date.now() - lastAt;
            const minGap = 400 + Math.random() * 200;
            if (sinceLast < minGap) {
                await this._sleep(minGap - sinceLast);
            }

            // A small, always-present jitter so consecutive sends never
            // look perfectly back-to-back even across different threads.
            await this._sleep(80 + Math.random() * 150);

            this.perThreadLastSendAt.set(key, Date.now());
            this.hourSendCount++;
            this.daySendCount++;
            const threadCount = (this.threadSendCounts.get(key) || 0) + 1;
            this.threadSendCounts.set(key, threadCount);
        } catch {
            // Pacing must never be the reason a real message fails to send.
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
    }

    stats() {
        return {
            warmup: this._inWarmup(),
            hourSendCount: this.hourSendCount,
            hourlyCap: this._hourlyCap(),
            daySendCount: this.daySendCount,
            dailyCap: this.dailyCap,
            coolingDown: this.isCoolingDown()
        };
    }
}

const pacer = new SendPacer();

module.exports = {
    SendPacer,
    globalAntiSuspension: {
        prepareBeforeMessage: (threadID) => pacer.waitForTurn(threadID),
        detectSuspensionSignal: (text) => pacer.scanForSuspicion(text),
        checkAccountHealth: (err) => pacer.noteSendError(err),
        getStats: () => pacer.stats()
    }
};
