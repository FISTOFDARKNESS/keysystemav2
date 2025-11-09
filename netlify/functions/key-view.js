const { Client } = require("pg");

exports.handler = async (event) => {
  let slug = decodeURIComponent(event.queryStringParameters?.key || "");
  if (!slug && event.path) {
    slug = decodeURIComponent(event.path.split("/id/")[1] || "");
  }
  if (!slug) return { statusCode: 404, body: "get the key again in the executor." };

  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_RVcjEu4DI3mJ@ep-dawn-tree-ad1airj2-pooler.c-2.us-east-1.aws.neon.tech/KeySytem?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const r = await client.query("SELECT token, expires_at FROM keys WHERE public_slug=$1 LIMIT 1", [slug]);

  if (!r.rows.length) {
    await client.end();
    return { statusCode: 404, body: "get tje key again in the executor" };
  }

  const row = r.rows[0];
  const expired = new Date() > new Date(row.expires_at);

  if (expired) {
    await client.query("DELETE FROM keys WHERE public_slug=$1", [slug]);
    await client.end();
    return { statusCode: 410, body: "get the key again in the executor" };
  }

  await client.end();

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Key</title>
        <style>
          body{background:#06060b;color:#dff9ff;font-family:Inter,Arial;text-align:center;padding-top:100px}
          .box{background:#0a0d14;padding:20px;border-radius:10px;width:320px;margin:auto}
          .key{font-family:Consolas,monospace;font-size:16px;padding:12px;background:#071019;border-radius:8px;margin:12px 0;color:#bff6ff;word-break:break-all}
          small{color:#9fb6c9}
        </style>
      </head>
      <body>
        <div class="box">
          <h2>VALID KEY</h2>
          <div class="key">${row.token}</div>
          <small>Expira em: ${new Date(row.expires_at).toLocaleString()}</small>
        </div>
      </body>
      </html>
    `
  };
};
