const { getClient } = require('./_db');
const { getClientIp, enrichIp, classifyByIspAsn } = require('./utils');

exports.handler = async function(event) {
  const headers = event.headers || {};
  const ip = getClientIp(headers);
  if (!ip) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'IP not found' }) };

  const geo = await enrichIp(ip);
  const isp = geo?.org || geo?.org_name || geo?.network || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;
  const country = geo?.country_name || null;
  const region = geo?.region || null;
  const city = geo?.city || null;

  const type = classifyByIspAsn(isp, asn);

  const client = getClient();
  await client.connect();
  const q = `INSERT INTO ip_log (ip, country, region, city, isp, asn, type, note)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const vals = [ip, country, region, city, isp, asn, type, null];
  const res = await client.query(q, vals);
  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, ip: ip, type: type, details: { country, region, city, isp, asn } })
  };
};
const { getClient } = require('./_db');
const { getClientIp, enrichIp, classifyByIspAsn } = require('./utils');

exports.handler = async function(event) {
  const headers = event.headers || {};
  const ip = getClientIp(headers);
  if (!ip) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'IP not found' }) };

  const geo = await enrichIp(ip);
  const isp = geo?.org || geo?.org_name || geo?.network || null;
  const asn = geo?.asn || geo?.autonomous_system_number || null;
  const country = geo?.country_name || null;
  const region = geo?.region || null;
  const city = geo?.city || null;

  const type = classifyByIspAsn(isp, asn);

  const client = getClient();
  await client.connect();
  const q = `INSERT INTO ip_log (ip, country, region, city, isp, asn, type, note)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const vals = [ip, country, region, city, isp, asn, type, null];
  const res = await client.query(q, vals);
  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, ip: ip, type: type, details: { country, region, city, isp, asn } })
  };
};
