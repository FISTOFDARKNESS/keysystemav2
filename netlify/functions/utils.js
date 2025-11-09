// utils.js (HMAC direto no código)
const fetch = require("node-fetch");
const crypto = require("crypto");

const HMAC_SECRET = "qualquerCoisaAqui123"; // 🔥 direto no código

// IP real do visitante
function getClientIp(headers) {
  if (headers["x-nf-client-connection-ip"]) return headers["x-nf-client-connection-ip"];
  if (headers["cf-connecting-ip"]) return headers["cf-connecting-ip"];
  if (headers["x-real-ip"]) return headers["x-real-ip"];
  const xff = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  return xff ? xff.split(",")[0].trim() : null;
}

// busca dados do IP (geo-ip)
async function enrichIp(ip) {
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    return r.ok ? r.json() : null;
  } catch (e) {
    return null;
  }
}

// classifica rede (residencial, datacenter ou mobile)
function classifyByIspAsn(isp, asn) {
  const txt = `${isp} ${asn}`.toLowerCase();
  if (txt.includes("amazon") || txt.includes("google") || txt.includes("ovh")) return "datacenter";
  if (txt.includes("tim") || txt.includes("vodafone") || txt.includes("claro")) return "mobile";
  return "residential";
}

// assinatura visitor ID
function signVisitorId(visitorId) {
  const sig = crypto.createHmac("sha256", HMAC_SECRET).update(visitorId).digest("hex");
  return `${visitorId}.${sig}`;
}

function verifyVisitorCookie(signed) {
  if (!signed.includes(".")) return null;
  const [vid, sig] = signed.split(".");
  const sigCalc = crypto.createHmac("sha256", HMAC_SECRET).update(vid).digest("hex");
  return sigCalc === sig ? vid : null;
}

module.exports = {
  getClientIp,
  enrichIp,
  classifyByIspAsn,
  signVisitorId,
  verifyVisitorCookie,
};
