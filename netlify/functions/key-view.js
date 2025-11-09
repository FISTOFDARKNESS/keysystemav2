const { getClient } = require("./_db");
const { verifyViewToken } = require("./utils");

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(";").map(x => {
    const [k, v] = x.trim().split("=");
    return [k, decodeURIComponent(v)];
  }));
}

exports.handler = async (event) => {
  let key = event.queryStringParameters?.key;
  if (!key && event.path) {
    const parts = event.path.split("/id/");
    if (parts.length > 1) key = parts[1];
  }

  if (!key) return { statusCode: 404, body: "Key não existe." };

  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || "");
  const viewToken = cookies["allow_view"] || null;
  const verified = verifyViewToken(viewToken);
  if (!verified || verified.key !== key) {
    return { statusCode: 403, body: "Acesso negado." };
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
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Key ${key}</title></head><body style="background:#06060b;color:#dff9ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01));padding:28px;border-radius:12px;box-shadow:0 8px 40px rgba(0,200,255,0.06);width:420px;text-align:center"><h1 style="color:#00d4ff;margin:0 0 8px;font-size:20px">Key</h1><div style="font-family:Consolas,monospace;font-size:18px;padding:12px;background:#071019;border-radius:8px;margin:12px 0;color:#bff6ff">${row.token}</div><small style="color:#9fb6c9">Expira em: ${new Date(row.expires_at).toLocaleString()}</small></div></body></html>`
    };
  } catch (e) {
    await db.end();
    return { statusCode: 500, body: "error" };
  }
};
