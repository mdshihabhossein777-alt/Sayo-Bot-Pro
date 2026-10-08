"use strict";

var fs = require("fs");
var path = require("path");

var actions = require("../../../src/actions");

describe("actions registry", function () {
  test("exports only file-backed action factories", function () {
    var actionsDir = path.join(__dirname, "../../../src/actions");
    var files = fs
      .readdirSync(actionsDir)
      .filter(function (name) {
        return name.endsWith(".js") && name !== "index.js";
      })
      .map(function (name) {
        return name.replace(/\.js$/, "");
      })
      .sort();

    var exported = Object.keys(actions).sort();

    exported.forEach(function (name) {
      expect(files.includes(name)).toBe(true);
      expect(typeof actions[name]).toBe("function");
    });

    expect(exported.length).toBeGreaterThan(0);
  });

  test("every exported action is a factory function", function () {
    Object.keys(actions).forEach(function (name) {
      expect(typeof actions[name]).toBe("function");
    });
  });
});
