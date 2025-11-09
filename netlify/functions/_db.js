const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.CONNECTION_STRING || null;

if (!CONNECTION_STRING) {
  console.warn('DATABASE_URL não definido. Configure no Netlify Environment Variables.');
}

function getClient() {
  return new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
}

module.exports = { getClient };
