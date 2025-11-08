const { getClient } = require('./_db');

exports.handler = async function(event) {
  const client = getClient();
  await client.connect();
  const now = new Date().toISOString();
  const q = `SELECT token, created_at, expires_at FROM keys WHERE expires_at > $1 ORDER BY created_at DESC LIMIT 1`;
  const res = await client.query(q, [now]);
  await client.end();

  if (!res.rows.length) {
    return { statusCode: 404, body: JSON.stringify({ success: false, message: 'No active key' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true, key: res.rows[0].token, expires_at: res.rows[0].expires_at }) };
};
