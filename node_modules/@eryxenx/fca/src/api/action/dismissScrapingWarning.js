"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");

module.exports = function (defaultFuncs, api, ctx) {
  return function dismissScrapingWarning(callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    const form = {
      av: ctx.userID,
      __user: ctx.userID,
      fb_dtsg: ctx.fb_dtsg || "",
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "FBScrapingWarningMutation",
      server_timestamps: "true",
      doc_id: "6339492849481770",
      variables: "{}"
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData && resData.errors) throw resData;
        log.info("dismissScrapingWarning", "Dismissed automated-behavior warning");
        return callback(null, { success: true });
      })
      .catch(function (err) {
        // Non-fatal: worst case the warning just stays on-screen, same as
        // if a human never tapped Dismiss.
        log.warn("dismissScrapingWarning", err && err.message ? err.message : String(err));
        return callback(err);
      });

    return returnPromise;
  };
};
