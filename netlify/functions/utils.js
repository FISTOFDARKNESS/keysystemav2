const crypto = require("crypto");
const fetch = require("node-fetch");
const secret = "qualquerCoisaAqui123";

function getClientIp(headers) {
  if (!headers) return "0.0.0.0";
  const xfwd = headers["x-forwarded-for"] || headers["X-Forwarded-For"] || null;
  if (xfwd && typeof xfwd === "string") return xfwd.split(",")[0].trim();
  return headers["client-ip"] || headers["remote-addr"] || "0.0.0.0";
}

async function enrichIp(ip) {
  try {
    const r = await fetch("https://ipapi.co/" + ip + "/json/");
    if (!r.ok) return null;
    return r.json();
  } catch (e) {
    return null;
  }
}

function sign(id) {
  return id + "." + crypto.createHmac("sha256", secret).update(id).digest("hex");
}

function verify(v) {
  if (!v || !v.includes(".")) return null;
  const [id, hash] = v.split(".");
  const expected = crypto.createHmac("sha256", secret).update(id).digest("hex");
  return expected === hash ? id : null;
}

function classifyByIspAsn(isp, asn) {
  if (isp && isp.toLowerCase().includes("aws")) return "datacenter";
  if (asn && typeof asn === "string" && asn.toLowerCase().includes("amazon")) return "datacenter";
  return "residential";
}

function createViewToken(key, ttlSeconds) {
  const expires = Date.now() + (ttlSeconds * 1000);
  const payload = `${key}|${expires}`;
  const b64 = Buffer.from(payload).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${mac}`;
}

function verifyViewToken(token) {
  if (!token || !token.includes(".")) return null;
  const [b64, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  if (expected !== mac) return null;
  let payload;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch (e) {
    return null;
  }
  const parts = payload.split("|");
  if (parts.length !== 2) return null;
  const key = parts[0];
  const expires = parseInt(parts[1], 10);
  if (Date.now() > expires) return null;
  return { key, expires };
}

module.exports = { getClientIp, enrichIp, sign, verify, classifyByIspAsn, createViewToken, verifyViewToken };
