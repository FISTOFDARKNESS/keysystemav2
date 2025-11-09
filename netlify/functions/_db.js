const { Client } = require("pg");

function getClient() {
  return new Client({
    connectionString: "postgresql://neondb_owner:npg_RVcjEu4DI3mJ@ep-dawn-tree-ad1airj2-pooler.c-2.us-east-1.aws.neon.tech/KeySytem?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  });
}

module.exports = { getClient };
