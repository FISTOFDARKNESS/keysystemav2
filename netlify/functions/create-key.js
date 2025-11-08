const { getClient } = require('./_db');
const { getClientIp, enrichIp, classifyByIspAsn } = require('./utils');
const { v4: uuidv4 } = require('uuid');

const ADMIN_SECRET = process.env.CREATE_KEY_ADMIN_SECRET || null;
const TTL_HOURS = parseInt(process.env.KEY_TTL_HOURS || '24', 10);
const RATE_LIMIT_PER_IP_24H = parseInt(process.env.RATE_LIMIT_PER_IP_24H || '3', 10);

exports.handler = async function(event) {
  if (ADMIN_SECRET) {
    const auth = (event.headers && (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'])) || null;
    if (auth !== ADMIN_SECRET) return { statusCode: 401, body: JSON.stringify({ success: false, message: 'unauthorized' }) };
  }

  const headers = event.headers || {};
  const ip = getClientIp(headers) || '0.0.0.0';

  const geo = await enrichIp(ip);
  const isp = geo?.org || geo?.org_name || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;
  const type = classifyByIspAsn(isp, asn);

  if (type === 'datacenter') return { statusCode: 403, body: JSON.stringify({ success: false, message: 'datacenter IPs not allowed' }) };

  const client = getClient();
  await client.connect();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const qCount = `SELECT count(*)::int AS cnt FROM keys WHERE issued_to_ip = $1 AND created_at > $2`;
  const cntRes = await client.query(qCount, [ip, since]);
  const cnt = cntRes.rows[0]?.cnt || 0;
  if (cnt >= RATE_LIMIT_PER_IP_24H) {
    await client.end();
    return { statusCode: 429, body: JSON.stringify({ success: false, message: 'rate limit exceeded' }) };
  }

  const token = uuidv4();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + TTL_HOURS * 60 * 60 * 1000);

  const q = `INSERT INTO keys (token, created_at, expires_at, issued_to_ip) VALUES ($1,$2,$3,$4) RETURNING token, expires_at`;
  const r = await client.query(q, [token, createdAt.toISOString(), expiresAt.toISOString(), ip]);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, key: r.rows[0].token, expires_at: r.rows[0].expires_at, issued_to_ip: ip })
  };
};
