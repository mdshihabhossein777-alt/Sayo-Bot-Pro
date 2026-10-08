"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");
const { getType } = require("../../utils/format");
module.exports = function(defaultFuncs, api, ctx) {
  return async function markAsRead(threadID, read, callback) {
    if (
      getType(read) === "Function" ||
      getType(read) === "AsyncFunction"
    ) {
      callback = read;
      read = true;
    }
    if (read == undefined) {
      read = true;
    }

    if (!callback) {
      callback = () => {};
    }

    const form = {};

    if (typeof ctx.globalOptions.pageID !== "undefined") {
      form["source"] = "PagesManagerMessagesInterface";
      form["request_user_id"] = ctx.globalOptions.pageID;
      form["ids[" + threadID + "]"] = read;
      form["watermarkTimestamp"] = new Date().getTime();
      form["shouldSendReadReceipt"] = true;
      form["commerce_last_message_type"] = "";
      //form["titanOriginatedThreadId"] = utils.generateThreadingID(ctx.clientID);

      let resData;
      try {
        resData = await defaultFuncs
          .post(
            "https://www.facebook.com/ajax/mercury/change_read_status.php",
            ctx.jar,
            form
          )
          .then(saveCookies(ctx.jar))
          .then(parseAndCheckLogin(ctx, defaultFuncs));
      } catch (e) {
        callback(e);
        return e;
      }

      if (resData.error) {
        const err = resData.error;
        log.error("markAsRead", err);
        if (getType(err) == "Object" && err.error === "Not logged in.") {
          ctx.loggedIn = false;
        }
        callback(err);
        return err;
      }

      callback();
      return null;
    } else {
      try {
        if (ctx.mqttClient && ctx.mqttClient.connected) {
          // Modern clients send read state as a label-21 ls_req task (the
          // same shape sendMessage.js already uses for its read watermark),
          // not the legacy /mark_thread topic or the Mercury-era
          // change_read_status.php endpoint.
          const requestId = Math.floor(100 + Math.random() * 900);
          const epoch = (BigInt(Date.now()) << 22n).toString();
          const content = {
            app_id: "2220391788200892",
            payload: JSON.stringify({
              tasks: [
                {
                  label: "21",
                  payload: JSON.stringify({
                    thread_id: String(threadID),
                    last_read_watermark_ts: Date.now(),
                    sync_group: 1
                  }),
                  queue_name: String(threadID),
                  task_id: Math.floor(100 + Math.random() * 900),
                  failure_count: null
                }
              ],
              epoch_id: epoch,
              version_id: "24804310205905615",
              data_trace_id: "#" + Buffer.from(String(Math.random())).toString("base64").replace(/=+$/, "")
            }),
            request_id: requestId,
            type: 3
          };
          const err = await new Promise(r =>
            ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, r)
          );
          if (err) throw err;
        } else {
          throw {
            error: "You can only use this function after you start listening."
          };
        }
      } catch (e) {
        callback(e);
        return e;
      }
      callback();
      return null;
    }
  };
};
