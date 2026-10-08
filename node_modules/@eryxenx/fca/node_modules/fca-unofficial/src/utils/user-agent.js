"use strict";

var defaultUserAgent = "facebookexternalhit/1.1";
var windowsUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomUserAgent() {
  var platforms = [
    "Windows NT 10.0; Win64; x64",
    "Macintosh; Intel Mac OS X 14.7; rv:132.0"
  ];
  var browsers = {
    chrome: ["122.0.0.0", "121.0.0.0"],
    firefox: ["123.0", "122.0"],
    edge: ["122.0.2365.92"]
  };
  var browserName = pick(Object.keys(browsers));
  var version = pick(browsers[browserName]);
  var platform = pick(platforms);
  var generated = browserName === "firefox"
    ? "Mozilla/5.0 (" + platform + ") Gecko/20100101 Firefox/" + version
    : "Mozilla/5.0 (" + platform + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + version + " Safari/537.36";

  return pick([
    generated,
    defaultUserAgent,
    windowsUserAgent,
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:45.0) Gecko/20100101 Firefox/45.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.3"
  ]);
}

module.exports = {
  defaultUserAgent: defaultUserAgent,
  windowsUserAgent: windowsUserAgent,
  randomUserAgent: randomUserAgent
};
