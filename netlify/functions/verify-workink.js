const fetch = require('node-fetch');

exports.handler = async function(event) {
  const WORKINK_VERIFY_BASE = process.env.WORKINK_VERIFY_BASE || 'https://work.ink/_api/v2/token/isValid';
  const token = (event.queryStringParameters && event.queryStringParameters.token) || null;
  if (!token) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'token missing' }) };

  const url = `${WORKINK_VERIFY_BASE}/${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { statusCode: r.status, body: JSON.stringify({ success: false, message: 'external error' }) };
    const json = await r.json();
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'fetch error' }) };
  }
};
