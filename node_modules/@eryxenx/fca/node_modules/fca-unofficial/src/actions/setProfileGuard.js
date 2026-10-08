"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (defaultFuncs, _api, ctx) {
  return function setProfileGuard(guard, callback) {
    var resolveFunc = function () {};
    var rejectFunc = function () {};
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (utils.getType(guard) !== "Boolean") {
      var typeErr = new Error("Please pass a boolean as the first argument.");
      callback(typeErr);
      return returnPromise;
    }

    var form = {
      av: ctx.userID,
      variables: JSON.stringify({
        input: {
          is_shielded: guard,
          actor_id: ctx.userID,
          client_mutation_id: "1"
        },
        scale: 1
      }),
      doc_id: "1477043292367183",
      fb_api_req_friendly_name: "IsShieldedSetMutation",
      fb_api_caller_class: "IsShieldedSetMutation"
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData.error || resData.err) throw resData;
        callback(null, true);
      })
      .catch(function (err) {
        log.error("setProfileGuard", err);
        callback(err);
      });

    return returnPromise;
  };
};
