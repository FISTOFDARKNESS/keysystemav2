const { Client } = require("pg")

exports.handler = async (event) => {
  let key = event.queryStringParameters?.key

  if (!key && event.path) {
    const parts = event.path.split("/id/")
    if (parts.length > 1) key = parts[1]
  }

  if (!key) return { statusCode: 404, body: "Key não existe." }

  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_RVcjEu4DI3mJ@ep-dawn-tree-ad1airj2-pooler.c-2.us-east-1.aws.neon.tech/KeySytem?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()

  const r = await client.query("SELECT token, expires_at FROM keys WHERE token=$1 LIMIT 1", [key])

  if (!r.rows.length) {
    await client.end()
    return { statusCode: 404, body: "Key não existe." }
  }

  const row = r.rows[0]
  const expired = new Date() > new Date(row.expires_at)

  if (expired) {
    await client.query("DELETE FROM keys WHERE token=$1", [key])
    await client.end()
    return { statusCode: 410, body: "Key expirada." }
  }

  await client.end()

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
      <head>
        <meta charset="utf-8">
        <title>Key</title>
        <style>
        body{background:#06060b;color:#dff9ff;font-family:Inter,Arial;text-align:center;padding-top:100px}
        .box{background:#0a0d14;padding:20px;border-radius:10px;width:300px;margin:auto}
        </style>
      </head>
      <body>
        <div class="box">
          <h2>KEY VÁLIDA</h2>
          <p>${row.token}</p>
        </div>
      </body>
      </html>
    `
  }
}
