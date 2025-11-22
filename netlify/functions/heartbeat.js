const { Client } = require("pg");

const DB = "postgresql://neondb_owner:npg_L3wzgaSW7rnR@ep-young-haze-adefzog1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const TTL = parseInt(30 || "30", 10);

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { session_token, hwid } = body;
  if (!session_token || !hwid) {
    return { statusCode: 400, body: JSON.stringify({ continue: false, message: "Missing token or hwid" })};
  }

  const client = new Client({ connectionString: DB });
  await client.connect();

  try {
    const res = await client.query(
      "SELECT id, key_code, hardware_id, expires_at FROM sessions WHERE session_token = $1 LIMIT 1",
      [session_token]
    );

    if (res.rows.length === 0) {
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ continue: false, message: "Invalid token" }) };
    }

    const row = res.rows[0];

    // checar hwid
    if (row.hardware_id !== hwid) {
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ continue: false, message: "HWID mismatch" }) };
    }

    const now = new Date();
    const expires = new Date(row.expires_at);
    if (expires < now) {
      // expirou
      await client.query("DELETE FROM sessions WHERE id = $1", [row.id]);
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ continue: false, message: "Session expired" }) };
    }

    // renova expiry (extend TTL)
    const newExp = new Date(Date.now() + TTL * 1000).toISOString();
    await client.query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [newExp, row.id]);

    await client.end();
    return { statusCode: 200, body: JSON.stringify({ continue: true, expires_at: newExp }) };

  } catch (err) {
    console.error(err);
    await client.end();
    return { statusCode: 500, body: JSON.stringify({ continue: false, message: "Server error" }) };
  }
};
