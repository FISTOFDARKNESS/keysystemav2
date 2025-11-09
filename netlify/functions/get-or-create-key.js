const { getClient } = require("./_db");
const { getClientIp, enrichIp, sign, verify, classifyByIspAsn } = require("./utils");
const { v4: uuidv4 } = require("uuid");

const KEY_TTL_HOURS = 24;
const RATE_LIMIT_PER_IP_24H = 1;

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(";").map(x => {
    const [k, v] = x.trim().split("=");
    return [k, decodeURIComponent(v)];
  }));
}

exports.handler = async function(event) {
  const headers = event.headers || {};
  const cookies = parseCookies(headers.cookie || headers.Cookie);
  let visitorCookie = cookies["visitor_id"] || null;
  let visitorId = verify(visitorCookie);

  if (!visitorId) {
    visitorId = uuidv4();
    visitorCookie = sign(visitorId);
  }

  const clientIp = getClientIp(headers);
  const geo = await enrichIp(clientIp);
  const isp = geo?.org || geo?.org_name || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;

  if (classifyByIspAsn(isp, asn) === "datacenter") {
    return {
      statusCode: 403,
      body: JSON.stringify({ success: false, message: "datacenter IPs not allowed" })
    };
  }

  const db = getClient();
  await db.connect();

  try {
    await db.query("INSERT INTO visitors(visitor_id) VALUES($1) ON CONFLICT(visitor_id) DO NOTHING", [visitorId]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rate = await db.query("SELECT count(*)::int AS cnt FROM keys WHERE issued_to_ip=$1 AND created_at>$2", [clientIp, since]);
    if (rate.rows[0].cnt >= RATE_LIMIT_PER_IP_24H) {
      await db.end();
      return { statusCode: 429, body: JSON.stringify({ success: false, message: "rate limit exceeded" }) };
    }

    const existing = await db.query("SELECT token, expires_at FROM keys WHERE owner_id=$1 AND expires_at>$2", [visitorId, new Date().toISOString()]);
    if (existing.rows.length) {
      await db.end();
      return {
        statusCode: 200,
        headers: { "Set-Cookie": "visitor_id=" + visitorCookie + "; Path=/; Max-Age=31536000; SameSite=Lax" },
        body: JSON.stringify({ success: true, key: existing.rows[0].token, expires_at: existing.rows[0].expires_at })
      };
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await db.query("INSERT INTO keys(token, owner_id, created_at, expires_at, issued_to_ip) VALUES($1,$2,NOW(),$3,$4)", [token, visitorId, expiresAt, clientIp]);

    await db.end();
    return {
      statusCode: 200,
      headers: { "Set-Cookie": "visitor_id=" + visitorCookie + "; Path=/; Max-Age=31536000; SameSite=Lax" },
      body: JSON.stringify({ success: true, key: token, expires_at: expiresAt })
    };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: JSON.stringify({ success: false }) };
  }
};
