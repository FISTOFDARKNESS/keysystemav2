// regen-key.js (sem process.env)
const { getClient } = require("./_db");
const { v4: uuidv4 } = require("uuid");

const CREATE_KEY_ADMIN_SECRET = "1234";
const KEY_TTL_HOURS = 24;

exports.handler = async function (event) {
  const auth = event.headers["x-admin-secret"];
  if (auth !== CREATE_KEY_ADMIN_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: "not allowed" }) };
  }

  const body = JSON.parse(event.body);
  const visitorId = body.visitor_id;

  const client = getClient();
  await client.connect();

  const token = uuidv4();
  const expires_at = new Date(Date.now() + KEY_TTL_HOURS * 3600000).toISOString();

  await client.query(
    `INSERT INTO keys (token, owner_id, created_at, expires_at) VALUES ($1,$2,now(),$3)`,
    [token, visitorId, expires_at]
  );

  await client.end();

  return { statusCode: 200, body: JSON.stringify({ success: true, key: token, expires_at }) };
};
