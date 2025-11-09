const { getClient } = require("./_db");
const { verifyKeySignature } = require("./utils");

exports.handler = async (event) => {
  let key = event.queryStringParameters?.key;
  const src = event.queryStringParameters?.src || '';
  const sig = event.queryStringParameters?.sig || '';
  
  if (!key) {
    if (event.path) {
      const parts = event.path.split("/id/");
      if (parts.length > 1) key = parts[1];
    }
  }
  
  if (!key) return { statusCode: 404, body: "Key não existe." };

  const referer = event.headers?.referer || event.headers?.Referer || '';

  if (!referer.includes("work.ink") || src !== "workink" || !verifyKeySignature(key, sig)) {
    return { statusCode: 403, body: "Acesso negado" };
  }

  const db = getClient();
  await db.connect();

  try {
    const r = await db.query("SELECT token, expires_at FROM keys WHERE token=$1 LIMIT 1", [key]);
    if (!r.rows.length) {
      await db.end();
      return { statusCode: 404, body: "Key não existe." };
    }

    const row = r.rows[0];
    const expired = new Date() > new Date(row.expires_at);
    if (expired) {
      await db.query("DELETE FROM keys WHERE token=$1", [key]);
      await db.end();
      return { statusCode: 410, body: "Key expirada." };
    }

    await db.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
      <html>
      <head><meta charset="utf-8"><title>Key</title></head>
      <body style="background:#06060b;color:#dff9ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="background:#0a0d14;padding:28px;border-radius:12px;text-align:center;width:420px">
          <h1 style="color:#00d4ff">KEY VÁLIDA</h1>
          <div style="font-family:Consolas,monospace;font-size:18px;padding:12px;background:#071019;border-radius:8px;margin:12px 0;color:#bff6ff">${row.token}</div>
          <small style="color:#9fb6c9">Expira em: ${new Date(row.expires_at).toLocaleString()}</small>
        </div>
      </body>
      </html>
      `
    };
  } catch(e) {
    await db.end();
    return { statusCode: 500, body: "Erro interno" };
  }
};
