// get-or-create-key.js (sem process.env)
const { getClient } = require("./_db");
const { getClientIp, enrichIp, classifyByIspAsn, signVisitorId, verifyVisitorCookie } = require("./utils");
const { v4: uuidv4 } = require("uuid");

const KEY_TTL_HOURS = 24;
const RATE_LIMIT_PER_IP_24H = 5;
const RATE_LIMIT_PER_VISITOR_24H = 1;

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, v] = c.trim().split("=");
      return [k, decodeURIComponent(v)];
    })
  );
}

exports.handler = async function (event) {
  const headers = event.headers || {};
  const cookies = parseCookies(headers.cookie || headers.Cookie);

  let signedVisitor = cookies["visitor_id"] || null;
  let visitorId = verifyVisitorCookie(signedVisitor);

  if (!visitorId) {
    visitorId = uuidv4();
    signedVisitor = signVisitorId(visitorId);
  }

  const clientIp = getClientIp(headers);
  const geo = await enrichIp(clientIp);

  const client = getClient();
  await client.connect();

  try {
    // registrar visitante
    await client.query(
      `INSERT INTO visitors(visitor_id) VALUES ($1) ON CONFLICT(visitor_id) DO NOTHING`,
      [visitorId]
    );

    const now = new Date().toISOString();

    // tem key ativa?
    const existing = await client.query(
      `SELECT token, expires_at FROM keys WHERE owner_id=$1 AND expires_at > $2`,
      [visitorId, now]
    );

    if (existing.rows.length) {
      return {
        statusCode: 200,
        headers: {
          "Set-Cookie": `visitor_id=${signedVisitor}; Path=/; Max-Age=31536000; SameSite=Lax`,
        },
        body: JSON.stringify({
          success: true,
          key: existing.rows[0].token,
          expires_at: existing.rows[0].expires_at,
        }),
      };
    }

    // criar nova key
    const token = uuidv4();
    const expires = new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await client.query(
      `INSERT INTO keys (token, owner_id, created_at, expires_at, issued_from_ip)
       VALUES ($1,$2,now(),$3,$4)`,
      [token, visitorId, expires, clientIp]
    );

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `visitor_id=${signedVisitor}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
      body: JSON.stringify({ success: true, key: token, expires_at: expires }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ success: false }) };
  } finally {
    await client.end();
  }
};
