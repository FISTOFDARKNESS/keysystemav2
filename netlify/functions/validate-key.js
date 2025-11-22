const { Client } = require("pg");
const crypto = require("crypto");

const DB = "postgresql://neondb_owner:npg_L3wzgaSW7rnR@ep-young-haze-adefzog1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const TTL = parseInt(30 || "30", 10);

function genToken(len = 67) {
  let s = "";
  while (s.length < len) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s.slice(0, len);
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { key, hwid } = body;
  if (!key || !hwid) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, message: "Missing key or hwid" })};
  }

  const client = new Client({ connectionString: DB });
  await client.connect();

  try {
    // Buscar key
    const res = await client.query(
      "SELECT hardware_id, is_active FROM keys WHERE key_code = $1 LIMIT 1",
      [key]
    );

    if (res.rows.length === 0) {
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ valid: false, message: "Key inválida" }) };
    }

    const row = res.rows[0];
    if (!row.is_active) {
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ valid: false, message: "Key desativada" }) };
    }

    if (row.hardware_id && row.hardware_id !== hwid) {
      await client.end();
      return { statusCode: 200, body: JSON.stringify({ valid: false, message: "Key vinculada a outro PC" }) };
    }

    // se hardware_id não setado, vincular (opcional)
    if (!row.hardware_id) {
      await client.query("UPDATE keys SET hardware_id = $1 WHERE key_code = $2", [hwid, key]);
    }

    // gerar sessão
    const session_token = genToken(67);
    const expires_at = new Date(Date.now() + TTL * 1000).toISOString();

    await client.query(
      "INSERT INTO sessions (session_token, key_code, hardware_id, expires_at) VALUES ($1,$2,$3,$4)",
      [session_token, key, hwid, expires_at]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        session_token,
        expires_at
      })
    };

  } catch (err) {
    console.error(err);
    await client.end();
    return { statusCode: 500, body: JSON.stringify({ valid: false, message: "Server error" }) };
  }
};
