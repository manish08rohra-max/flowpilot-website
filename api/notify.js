"use strict";
/* FlowPilot enquiry notifications — SMTP via nodemailer.
   Enabled ONLY when SMTP_HOST, SMTP_USER and SMTP_PASS are all set in the
   environment. Without them this module reports enabled:false and nothing in
   the site may claim email delivery — the database row is the record of truth.
   PHP mail() does not exist in Node.js hosting; no attempt is made to use it. */

module.exports = function createNotifier(env) {
  env = env || process.env;

  function disabled(reason) {
    return {
      enabled: false,
      reason: reason,
      send: function () { return Promise.resolve(false); }
    };
  }

  const host = String(env.SMTP_HOST || "").trim();
  const user = String(env.SMTP_USER || "").trim();
  const pass = env.SMTP_PASS || "";
  if (!host || !user || !pass) {
    return disabled("SMTP_HOST/SMTP_USER/SMTP_PASS not set");
  }

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    return disabled("nodemailer not installed (run: npm install)");
  }

  const port = parseInt(env.SMTP_PORT, 10) || 587;
  const secure = String(env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const from = String(env.NOTIFY_FROM || user).trim();   // use a mailbox you control
  const to = String(env.NOTIFY_EMAIL || "info@flowpilotai.co.in").trim();

  const transport = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: { user: user, pass: pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  function buildText(record) {
    return [
      "Name: " + record.name,
      "Business: " + (record.business || "-"),
      "Email: " + record.email,
      "Phone: " + (record.phone || "-"),
      "Area of interest: " + (record.topic || "General"),
      "",
      "Workflow / problem:",
      record.message
    ].join("\n");
  }

  return {
    enabled: true,
    reason: "",
    send: function (record) {
      return transport.sendMail({
        from: from,
        replyTo: record.email,
        to: to,
        subject: "Website enquiry — " + (record.topic || "General"),
        text: buildText(record)
      }).then(function () { return true; });
    }
  };
};
