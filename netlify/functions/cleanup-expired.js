const { getClient } = require("./_db");

exports.handler = async function() {
  const db = getClient();
  await db.connect();
  try {
    await db.query("DELETE FROM keys WHERE expires_at <= NOW()");
    await db.end();
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: "error" };
  }
};
