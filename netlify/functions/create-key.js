const { getClient } = require('./_db');
const { v4: uuidv4 } = require('uuid');

const ADMIN_SECRET = 1234 || null;
const TTL_HOURS = parseInt(24 || '24', 10);

exports.handler = async function(event) {
  if (ADMIN_SECRET) {
    const auth = (event.headers && (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'])) || null;
    if (auth !== ADMIN_SECRET) return {
      statusCode: 401,
      body: JSON.stringify({ success: false, message: 'unauthorized' })
    };
  }

  const client = getClient();
  await client.connect();

  const token = uuidv4();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + TTL_HOURS * 60 * 60 * 1000);

  const q = `
    INSERT INTO keys (token, created_at, expires_at)
    VALUES ($1, $2, $3)
    RETURNING token, created_at, expires_at
  `;
  const r = await client.query(q, [token, createdAt.toISOString(), expiresAt.toISOString()]);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      key: r.rows[0].token,
      created_at: r.rows[0].created_at,
      expires_at: r.rows[0].expires_at
    })
  };
};
const { getClient } = require('./_db');
const { v4: uuidv4 } = require('uuid');

const ADMIN_SECRET = 1234 || null;
const TTL_HOURS = parseInt(24 || '24', 10);

exports.handler = async function(event) {
  if (ADMIN_SECRET) {
    const auth = (event.headers && (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'])) || null;
    if (auth !== ADMIN_SECRET) return {
      statusCode: 401,
      body: JSON.stringify({ success: false, message: 'unauthorized' })
    };
  }

  const client = getClient();
  await client.connect();

  const token = uuidv4();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + TTL_HOURS * 60 * 60 * 1000);

  const q = `
    INSERT INTO keys (token, created_at, expires_at)
    VALUES ($1, $2, $3)
    RETURNING token, created_at, expires_at
  `;
  const r = await client.query(q, [token, createdAt.toISOString(), expiresAt.toISOString()]);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      key: r.rows[0].token,
      created_at: r.rows[0].created_at,
      expires_at: r.rows[0].expires_at
    })
  };
};
