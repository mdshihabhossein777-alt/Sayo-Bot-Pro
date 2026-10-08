"use strict";

const login = require("./module/login");
const { createFcaClient } = require("./src/app/createFcaClient");
const { MessengerBot, createMessengerBot } = require("./src/app/MessengerBot");
const { MessengerContext } = require("./src/app/MessengerContext");
const { attachThreadInfoRealtimeSync, applyThreadInfoRealtimeEvent } = require("./src/app/threadInfoRealtimeSync");
const humanizer = require("./src/utils/humanizer");

// CommonJS default export — the login function (classic FCA / GoatBot compatible)
module.exports = login;

// Named exports
module.exports.login = login;
module.exports.default = login;

// New features from dongdev
module.exports.createFcaClient = createFcaClient;
module.exports.MessengerBot = MessengerBot;
module.exports.createMessengerBot = createMessengerBot;
module.exports.MessengerContext = MessengerContext;
module.exports.attachThreadInfoRealtimeSync = attachThreadInfoRealtimeSync;
module.exports.applyThreadInfoRealtimeEvent = applyThreadInfoRealtimeEvent;

// Command anti-spam / humanizer
module.exports.CommandHumanizer = humanizer.CommandHumanizer;
module.exports.createCommandHumanizer = humanizer.createCommandHumanizer;
module.exports.createHumanizerMiddleware = humanizer.createHumanizerMiddleware;
module.exports.humanizer = humanizer;
