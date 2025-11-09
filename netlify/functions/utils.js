const crypto = require("crypto");
const fetch = require("node-fetch");
const secret = "1234";

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

function createKeySignature(key) {
  return crypto.createHmac("sha256", secret).update(key).digest("hex");
}

function verifyKeySignature(key, sig) {
  const expected = createKeySignature(key);
  return expected === sig;
}

module.exports = { getClientIp, enrichIp, sign, verify, classifyByIspAsn, createKeySignature, verifyKeySignature };
