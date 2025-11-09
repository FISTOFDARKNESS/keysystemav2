const { getClient } = require("./_db");

exports.handler = async function(event) {
  const path = event.path || "";
  const parts = path.split("/").filter(Boolean);
  const idx = parts.indexOf("id");
  const token = idx >= 0 && parts[idx+1] ? parts[idx+1] : null;
  if (!token) return { statusCode: 400, body: "missing id" };

  const db = getClient();
  await db.connect();

  try {
    const result = await db.query("SELECT token, expires_at FROM keys WHERE token=$1", [token]);
    if (!result.rows.length) {
      await db.end();
      return { statusCode: 404, headers: { "Content-Type": "text/html" }, body: "<h1>get the key again</h1>" };
    }

    const key = result.rows[0];
    const expired = new Date() > new Date(key.expires_at);

    if (expired) {
      await db.query("DELETE FROM keys WHERE token=$1", [token]);
      await db.end();
      return { statusCode: 410, headers: { "Content-Type": "text/html" }, body: "<h1>get the key again.</h1>" };
    }

    await db.end();
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Key ${token}</title></head><body style="background:#06060b;color:#dff9ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01));padding:28px;border-radius:12px;box-shadow:0 8px 40px rgba(0,200,255,0.06);width:420px;text-align:center"><h1 style="color:#00d4ff;margin:0 0 8px;font-size:20px">Key</h1><div style="font-family:Consolas,monospace;font-size:18px;padding:12px;background:#071019;border-radius:8px;margin:12px 0;color:#bff6ff">${key.token}</div><small style="color:#9fb6c9">Expira em: ${new Date(key.expires_at).toLocaleString()}</small></div></body></html>`;
    return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: "error" };
  }
};
