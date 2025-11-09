const { Client } = require("pg");
const { v4: uuidv4 } = require("uuid");

const DATABASE_URL = "postgresql://neondb_owner:npg_RVcjEu4DI3mJ@ep-dawn-tree-ad1airj2-pooler.c-2.us-east-1.aws.neon.tech/KeySytem?sslmode=require&channel_binding=require";
const KEY_TTL_HOURS = 24;

function getClient() {
  return new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

exports.handler = async function(event) {
  const ip = event.headers["x-nf-client-connection-ip"] || "0.0.0.0";
  const db = getClient();
  await db.connect();

  try {
    const now = new Date().toISOString();

    // Verifica se já existe uma key válida para esse IP
    const res = await db.query(
      "SELECT token, expires_at FROM keys WHERE issued_to_ip=$1 AND expires_at>$2 LIMIT 1",
      [ip, now]
    );

    if (res.rows.length) {
      await db.end();
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, key: res.rows[0].token, expires_at: res.rows[0].expires_at })
      };
    }

    // Cria nova key
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await db.query(
      "INSERT INTO keys(token, created_at, expires_at, issued_to_ip) VALUES($1, NOW(), $2, $3)",
      [token, expiresAt, ip]
    );

    await db.end();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, key: token, expires_at: expiresAt })
    };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
