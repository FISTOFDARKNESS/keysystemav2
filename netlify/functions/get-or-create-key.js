const { getClient } = require("./_db");
const { getClientIp, enrichIp, sign, verify, classifyByIspAsn } = require("./utils");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const KEY_TTL_HOURS = 24;
const RATE_LIMIT_PER_IP_24H = 1;
const SLUG_LETTERS = 18;
const SIG_SECRET = "1234";

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(";").map(x => {
    const [k, v] = x.trim().split("=");
    return [k, decodeURIComponent(v)];
  }));
}

function randLetters(n){
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for(let i=0;i<n;i++) s += letters[Math.floor(Math.random()*letters.length)];
  return s;
}

function makePublicSlug(token){
  const prefix = randLetters(SLUG_LETTERS);
  const sig = crypto.createHmac("sha256", SIG_SECRET).update(token).digest("hex");
  return `${prefix}-src=workink&sig=${sig}`;
}

exports.handler = async function(event) {
  const headers = event.headers || {};
  const cookies = parseCookies(headers.cookie || headers.Cookie);
  const headerVisitor = (headers["x-visitor-id"] || headers["X-Visitor-Id"] || null);
  let visitorCookie = cookies["visitor_id"] || null;
  let visitorId = null;

  if (headerVisitor) {
    if (headerVisitor.includes(".")) {
      const verified = verify(headerVisitor);
      if (verified) visitorId = verified;
    } else {
      visitorId = headerVisitor;
      visitorCookie = sign(visitorId);
    }
  } else {
    visitorId = verify(visitorCookie);
    if (!visitorId) {
      visitorId = uuidv4();
      visitorCookie = sign(visitorId);
    }
  }

  const clientIp = getClientIp(headers) || "0.0.0.0";
  const geo = await enrichIp(clientIp);
  const isp = geo?.org || geo?.org_name || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;

  if (classifyByIspAsn(isp, asn) === "datacenter") {
    return { statusCode: 403, body: JSON.stringify({ success: false, message: "datacenter IPs not allowed" }) };
  }

  const db = getClient();
  await db.connect();

  try {
    await db.query("INSERT INTO visitors(visitor_id) VALUES($1) ON CONFLICT(visitor_id) DO NOTHING", [visitorId]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rate = await db.query("SELECT count(*)::int AS cnt FROM keys WHERE issued_from_ip=$1 AND created_at>$2", [clientIp, since]);
    if (rate.rows[0].cnt >= RATE_LIMIT_PER_IP_24H) {
      await db.end();
      return { statusCode: 429, body: JSON.stringify({ success: false, message: "rate limit exceeded" }) };
    }

    const now = new Date().toISOString();
    const existing = await db.query("SELECT token, expires_at, public_slug FROM keys WHERE owner_id=$1 AND expires_at>$2 ORDER BY created_at DESC LIMIT 1", [visitorId, now]);
    if (existing.rows.length) {
      await db.end();
      return {
        statusCode: 200,
        headers: { "Set-Cookie": "visitor_id=" + visitorCookie + "; Path=/; Max-Age=31536000; SameSite=Lax" },
        body: JSON.stringify({ success: true, visitor_id: visitorId, key: existing.rows[0].token, expires_at: existing.rows[0].expires_at, public_slug: existing.rows[0].public_slug })
      };
    }

    const token = uuidv4();
    const public_slug = makePublicSlug(token);
    const expiresAt = new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await db.query("INSERT INTO keys(token, owner_id, created_at, expires_at, issued_from_ip, public_slug) VALUES($1,$2,NOW(),$3,$4,$5)", [token, visitorId, expiresAt, clientIp, public_slug]);

    await db.end();
    return {
      statusCode: 200,
      headers: { "Set-Cookie": "visitor_id=" + visitorCookie + "; Path=/; Max-Age=31536000; SameSite=Lax" },
      body: JSON.stringify({ success: true, visitor_id: visitorId, key: token, expires_at: expiresAt, public_slug: public_slug })
    };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
