const { Client } = require("pg");

exports.handler = async (event, context) => {
  const { key, hwid } = JSON.parse(event.body);

  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_L3wzgaSW7rnR@ep-young-haze-adefzog1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const result = await client.query(
    "SELECT hardware_id, is_active FROM keys WHERE key_code = $1",
    [key]
  );

  if (result.rows.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: false, msg: "Key inválida" })};
  }

  const row = result.rows[0];

  if (!row.is_active) {
    return { statusCode: 200, body: JSON.stringify({ success: false, msg: "Key desativada" })};
  }

  if (!row.hardware_id) {
    await client.query(
      "UPDATE keys SET hardware_id = $1 WHERE key_code = $2",
      [hwid, key]
    );
  } else if (row.hardware_id !== hwid) {
    return { statusCode: 200, body: JSON.stringify({ success: false, msg: "Key usada em outro PC" })};
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      session_token: Math.random().toString(36).substring(2, 40)
    })
  };
};
