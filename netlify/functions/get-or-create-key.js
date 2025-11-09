const { getClient } = require('./_db');
const { getClientIp, enrichIp, classifyByIspAsn, genVisitorId } = require('./utils');
const { v4: uuidv4 } = require('uuid');

const TTL_HOURS = parseInt(process.env.KEY_TTL_HOURS || '24', 10);
const RATE_LIMIT_PER_IP_24H = parseInt(process.env.RATE_LIMIT_PER_IP_24H || '5', 10);

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').map(s=>s.trim()).reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const k = pair.slice(0, idx);
    const v = pair.slice(idx+1);
    acc[k] = v;
    return acc;
  }, {});
}

exports.handler = async function(event) {
  const headers = event.headers || {};
  const cookieHeader = headers.cookie || headers.Cookie || '';
  const cookies = parseCookies(cookieHeader);
  let visitorId = (event.queryStringParameters && event.queryStringParameters.visitor_id) || headers['x-visitor-id'] || cookies['visitor_id'] || null;

  const clientIp = getClientIp(headers) || '0.0.0.0';
  const geo = await enrichIp(clientIp);
  const isp = geo?.org || geo?.org_name || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;
  const ipType = classifyByIspAsn(isp, asn);

  const client = getClient();
  await client.connect();

  try {
    if (!visitorId) {
      visitorId = genVisitorId();
    }

    // log IP usage
    try {
      await client.query(
        `INSERT INTO ip_log (ip, visitor_id, country, region, city, isp, asn, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [clientIp, visitorId, geo?.country_name || null, geo?.region || null, geo?.city || null, isp, asn, ipType]
      );
    } catch(e) {
      // ignore log errors
      console.error('ip_log error', e.message);
    }

    const now = new Date().toISOString();

    // check existing valid key for this visitor
    const q = `SELECT token, expires_at FROM keys WHERE owner_id = $1 AND expires_at > $2 ORDER BY created_at DESC LIMIT 1`;
    const res = await client.query(q, [visitorId, now]);

    let token, expires_at;

    if (res.rows.length) {
      token = res.rows[0].token;
      expires_at = res.rows[0].expires_at;
    } else {
      // rate limit by ip: count keys created from this ip in last 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      try {
        const cntRes = await client.query(`SELECT count(*)::int as cnt FROM keys WHERE issued_from_ip = $1 AND created_at > $2`, [clientIp, since]);
        const cnt = cntRes.rows[0]?.cnt || 0;
        if (cnt >= RATE_LIMIT_PER_IP_24H) {
          await client.end();
          return {
            statusCode: 429,
            body: JSON.stringify({ success: false, message: 'rate limit exceeded' })
          };
        }
      } catch (e) {
        // ignore
      }

      token = uuidv4();
      const createdAt = new Date();
      expires_at = new Date(createdAt.getTime() + TTL_HOURS * 60 * 60 * 1000).toISOString();

      const insertQ = `INSERT INTO keys (token, owner_id, created_at, expires_at, issued_from_ip) VALUES ($1,$2,$3,$4,$5) RETURNING token, expires_at`;
      const r = await client.query(insertQ, [token, visitorId, createdAt.toISOString(), expires_at, clientIp]);
      token = r.rows[0].token;
      expires_at = r.rows[0].expires_at;
    }

    await client.end();

    const setCookie = `visitor_id=${visitorId}; Path=/; Max-Age=${60*60*24*365}; SameSite=Lax`;

    return {
      statusCode: 200,
      headers: { 'Set-Cookie': setCookie, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ success: true, visitor_id: visitorId, key: token, expires_at })
    };
  } catch (err) {
    await client.end();
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
