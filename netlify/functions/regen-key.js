const { getClient } = require('./_db');
const { getClientIp, enrichIp } = require('./utils');
const { v4: uuidv4 } = require('uuid');

const ADMIN_SECRET = process.env.CREATE_KEY_ADMIN_SECRET || null;
const TTL_HOURS = parseInt(process.env.KEY_TTL_HOURS || '24', 10);

exports.handler = async function(event) {
  if (ADMIN_SECRET) {
    const auth = (event.headers && (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'])) || null;
    if (auth !== ADMIN_SECRET) return { statusCode: 401, body: JSON.stringify({ success: false, message: 'unauthorized' }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const visitorId = body.visitor_id || (event.queryStringParameters && event.queryStringParameters.visitor_id);
  if (!visitorId) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'visitor_id missing' }) };

  const clientIp = getClientIp(event.headers) || '0.0.0.0';
  const client = getClient();
  await client.connect();

  try {
    const token = uuidv4();
    const createdAt = new Date();
    const expires_at = new Date(createdAt.getTime() + TTL_HOURS * 60 * 60 * 1000).toISOString();

    const q = `INSERT INTO keys (token, owner_id, created_at, expires_at, issued_from_ip) VALUES ($1,$2,$3,$4,$5) RETURNING token, expires_at`;
    const r = await client.query(q, [token, visitorId, createdAt.toISOString(), expires_at, clientIp]);

    await client.end();

    return { statusCode: 200, body: JSON.stringify({ success: true, visitor_id: visitorId, key: r.rows[0].token, expires_at: r.rows[0].expires_at }) };
  } catch (err) {
    await client.end();
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
