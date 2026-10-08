const fs = require("fs");
const path = require("path");
const logger = require("../func/logger");
const defaultConfig = {
  autoUpdate: true,
  mqtt: { enabled: true, reconnectInterval: 3600 },
  // Opt-in only: auto re-login with credentials (via the third-party API)
  // after a checkpoint/session failure is itself a strong suspicious-login
  // signal and invalidates every other live session on the account.
  autoLogin: false,
  apiServer: "https://minhdong.site",
  apiKey: "",
  credentials: { email: "", password: "", twofactor: "" },
  antiGetInfo: {
    AntiGetThreadInfo: false,
    AntiGetUserInfo: false
  },
  remoteControl: {
    enabled: false,
    url: "",
    token: "",
    autoReconnect: true
  }
};

function loadConfig() {
  const configPath = path.join(process.cwd(), "fca-config.json");
  let config;
  if (!fs.existsSync(configPath)) {
    config = defaultConfig;
  } else {
    try {
      const fileContent = fs.readFileSync(configPath, "utf8");
      config = Object.assign({}, defaultConfig, JSON.parse(fileContent));
    } catch (err) {
      logger(`Error reading config file: ${err.message}`, "error");
      config = defaultConfig;
    }
  }
  return { config, configPath };
}

module.exports = { loadConfig, defaultConfig };