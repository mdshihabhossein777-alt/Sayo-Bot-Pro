"use strict";

var utils = require("../utils");
var log = require("npmlog");


module.exports = function(defaultFuncs, api, ctx) {
  return function unsendMessage(messageID, callback, threadID) {
    var resolveFunc = function(){};
    var rejectFunc = function(){};
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (utils.getType(callback) === "String" && !threadID) {
      threadID = callback;
      callback = null;
    }

    if (utils.getType(messageID) === "Object") {
      threadID = messageID.chatJid || messageID.threadID || threadID;
      messageID = messageID.messageID || messageID.id;
    }

    if (!callback) {
      callback = function (err, friendList) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(friendList);
      };
    }


    var form = {
      message_id: messageID
    };

    defaultFuncs
      .post(
        "https://www.facebook.com/messaging/unsend_message/",
        ctx.jar,
        form
      )
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function(resData) {
        if (resData.error) {
          throw resData;
        }

        return callback();
      })
      .catch(function(err) {
        log.error("unsendMessage", err);
        return callback(err);
      });

    return returnPromise;
  };
};
