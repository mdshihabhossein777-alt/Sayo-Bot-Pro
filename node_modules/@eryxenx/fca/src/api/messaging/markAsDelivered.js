"use strict";
const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");
const { getType } = require("../../utils/format");
module.exports = function(defaultFuncs, api, ctx) {
  return function markAsDelivered(threadID, messageID, callback) {
    let resolveFunc = function() {};
    let rejectFunc = function() {};
    const returnPromise = new Promise(function(resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function(err, friendList) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(friendList);
      };
    }

    if (!threadID || !messageID) {
      return callback("Error: messageID or threadID is not defined");
    }

    // Modern Messenger clients do not POST delivery receipts to the
    // Mercury-era delivery_receipts.php endpoint — delivery is implicit in
    // the MQTT sync channel. Calling that endpoint once per incoming message
    // (which GoatBot's handlerEvents does) produced a constant stream of
    // request shapes no real client emits. When MQTT is live we resolve
    // immediately; the legacy HTTP call is kept only as a fallback for
    // callers that explicitly use this API without an active listener.
    if (ctx.mqttClient && ctx.mqttClient.connected) {
      callback();
      return returnPromise;
    }

    const form = {};

    form["message_ids[0]"] = messageID;
    form["thread_ids[" + threadID + "][0]"] = messageID;

    defaultFuncs
      .post(
        "https://www.facebook.com/ajax/mercury/delivery_receipts.php",
        ctx.jar,
        form
      )
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(function(resData) {
        if (resData.error) {
          throw resData;
        }

        return callback();
      })
      .catch(function(err) {
        log.error("markAsDelivered", err);
        if (getType(err) == "Object" && err.error === "Not logged in.") {
          ctx.loggedIn = false;
        }
        return callback(err);
      });

    return returnPromise;
  };
};
