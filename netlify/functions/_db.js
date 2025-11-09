const { Client } = require('pg');

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
}

module.exports = { getClient };
