const fetch = require('node-fetch');

exports.handler = async function(event) {
  const token = (event.queryStringParameters && event.queryStringParameters.token) || null;
  if (!token) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'token missing' }) };

  const url = `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return { statusCode: r.status, body: JSON.stringify({ success: false, message: 'external error' }) };
    const json = await r.json();
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'fetch error', error: e.message }) };
  }
};
