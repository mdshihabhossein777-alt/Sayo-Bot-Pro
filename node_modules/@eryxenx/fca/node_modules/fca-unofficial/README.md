# Unofficial Facebook Chat API

<div align="center">
  <a href="https://www.npmjs.com/package/@vangbanlanhat/fca-unofficial"><img alt="npm version" src="https://img.shields.io/npm/v/@vangbanlanhat/fca-unofficial.svg?style=flat-square"></a>
  <img alt="version" src="https://img.shields.io/github/package-json/v/VangBanLaNhat/fca-unofficial?label=github&style=flat-square">
  <a href="https://www.npmjs.com/package/@vangbanlanhat/fca-unofficial"><img src="https://img.shields.io/npm/dm/fca-unofficial.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/prettier/prettier"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>
</div>

This project provides an unofficial API for automating Facebook chat and Messenger functionalities. Facebook has deprecated their XMPP chat interface, leaving emulating a browser as the only viable method for account automation. 

This API simulates exact GET/POST requests and MQTT connections, tricking Facebook into thinking it's a legitimate browser session.

> **Disclaimer:** We are not responsible if your account gets banned for spammy activities (sending messages too quickly, spamming strangers, logging in/out rapidly). Be a responsible Facebook citizen. Use [Facebook Whitehat Accounts](https://www.facebook.com/whitehat/accounts/) for safe testing.

---

## Documentation

For a comprehensive list of all available API methods, options, and parameters, please see the **[Full API Documentation (DOCS.md)](DOCS.md)**.

## Tech Stack

- **Language**: JavaScript (Node.js)
- **Real-time Protocol**: MQTT (`mqtt` package)
- **HTML Parsing**: `cheerio`
- **Networking**: Built-in HTTP/HTTPS + `https-proxy-agent`
- **Testing Framework**: Jest

## Prerequisites

- **Node.js**: v14.0.0 or higher
- **NPM or Yarn**: To install dependencies
- A valid Facebook account or a Facebook Whitehat Account for testing.

## Getting Started

### 1. Installation

Install the package via NPM:

```bash
npm i @vangbanlanhat/fca-unofficial
```

### 2. Basic Echo Bot Example

Create an `index.js` file and add the following code to create a bot that echoes messages back to the sender:

```javascript
const login = require("@vangbanlanhat/fca-unofficial");

// Login using your Facebook credentials
login({email: "FB_EMAIL", password: "FB_PASSWORD"}, (err, api) => {
    if(err) return console.error("Login failed:", err);

    console.log("Bot successfully logged in!");

    // Start listening for incoming messages
    api.listen((err, message) => {
        if(err) return console.error(err);

        // Echo the message back to the same chat thread
        api.sendMessage("Echo: " + message.body, message.threadID);
    });
});
```

Run your bot:
```bash
node index.js
```

### 3. Saving the Session (Avoiding Bans & Re-logins)

Logging in repeatedly with an email and password is a massive red flag for Facebook's anti-spam systems. **You must save and reuse your session (AppState).**

```javascript
const fs = require("fs");
const login = require("@vangbanlanhat/fca-unofficial");

// 1. Try to load an existing session
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));
} catch (e) {
    console.log("No saved session found. Logging in with credentials...");
}

const credentials = appState 
    ? { appState: appState } 
    : { email: "FB_EMAIL", password: "FB_PASSWORD" };

login(credentials, (err, api) => {
    if(err) return console.error(err);

    // 2. Save the session for the next run
    fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
    console.log("Logged in and session saved!");

    // ... continue with your bot logic ...
});
```

*Alternative:* You can use browser extensions like [c3c-fbstate](https://github.com/lequanglam/c3c-fbstate) to manually extract your `fbstate.json` (appstate) directly from your browser.

## Architecture Overview

This library essentially functions as a headless Facebook web client.

### Request Lifecycle
1. **Login:** The library performs a sequence of GET/POST requests to Facebook's login endpoints, mimicking a real browser login to acquire authentication cookies (`c_user`, `xs`, etc.).
2. **Context Creation:** It builds an internal `ctx` (context) object containing your User ID, Client ID, and cookies.
3. **MQTT Connection:** It establishes an MQTT over WebSockets connection to Facebook's servers to receive real-time events (new messages, typing indicators, read receipts).
4. **Action Execution:** When you call an API method (like `sendMessage`), the library constructs the exact GraphQL or form-data HTTP request that the Messenger web app would send, and dispatches it.

### Core Directory Structure

```text
src/
├── index.js          # Main entrypoint and API builder
├── actions/      # Contains all the individual API methods
│   ├── listenMqtt.js # Manages the real-time MQTT socket
│   ├── sendMessage.js# Handles message formatting and sending
│   └── ...           # Other actions (reactions, unsending, etc.)
└── utils/            # Shared utilities
    ├── auth.js       # Cookie formatting and session extraction
    ├── base.js       # Core network request wrappers (get, post)
    ├── formatters.js # Parsers that turn raw FB payloads into clean JSON
    └── identity.js   # Generators for IDs, GUIDs, and timestamps
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run test` | Runs the full Jest test suite |
| `npm run test:unit` | Runs only unit tests |
| `npm run test:integration`| Runs integration tests (requires active config) |
| `npm run lint` | Runs ESLint to check for syntax/style issues |
| `npm run prettier` | Formats all code using Prettier |

## Testing

The project uses **Jest** for unit and integration testing.

To run the unit tests:
```bash
npm run test:unit
```

To run integration tests (which actually hit Facebook endpoints), you must first create a valid config:
1. Copy `example-config.json` to `test-config.json` inside the `test` directory.
2. Fill in your test account credentials or appState.
3. Run: `npm run test:integration`

## Deployment

Since this is a standard Node.js application, you can deploy your bot anywhere Node.js runs (VPS, Heroku, Render, AWS, Docker).

**Important Deployment Tips:**
1. **Do not commit `appstate.json` or passwords to Git.** Use environment variables for sensitive data.
2. **IP Changes:** If you deploy your bot to a cloud server in a different country, Facebook might temporarily lock the account due to a "Suspicious Login". You may need to log into the account manually and approve the new location.

## Troubleshooting

### 1. "Login failed" or getting prompted for a code
If you have Two-Factor Authentication (2FA) or Login Approvals enabled, you must handle the approval step. Read the specific guide on [handling login approvals](DOCS.md#login).

### 2. My account got locked/banned!
This happens if you send messages too fast or to people who are not your friends. 
- Use `setTimeout` to add human-like delays.
- Always use cached sessions (`appState`) instead of logging in repeatedly.
- Use a throwaway account for development.

### 3. `sendMessage` isn't working when logged in as a Page
Facebook Pages cannot initiate conversations with users to prevent spam. Your bot can only reply to users who have messaged the Page first within the last 24 hours.

### 4. How do I stop the spammy console logs?
Pass a `logLevel` option when configuring the API:
```javascript
api.setOptions({
    logLevel: "silent" // Options: "silly", "verbose", "info", "warn", "error", "silent"
});
```

---

## Projects using this API

- [c3c](https://github.com/lequanglam/c3c) - A bot that can be customizable using plugins. Support Facebook & Discord.

**Historical Projects (from the original `facebook-chat-api`):**
- [Messer](https://github.com/mjkaufer/Messer) - Command-line messaging for Facebook Messenger
- [messen](https://github.com/tomquirk/messen) - Rapidly build Facebook Messenger apps in Node.js
- [Concierge](https://github.com/concierge/Concierge) - Modular chat bot with a package manager
- [Botium](https://github.com/codeforequity-at/botium-core) - The Selenium for Chatbots
- [Miscord](https://github.com/Bjornskjald/miscord) - Facebook bridge for Discord.
