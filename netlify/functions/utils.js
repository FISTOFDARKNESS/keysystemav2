const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

function getClientIp(headers) {
  if (!headers) return null;
  if (headers['x-nf-client-connection-ip']) return headers['x-nf-client-connection-ip'];
  if (headers['cf-connecting-ip']) return headers['cf-connecting-ip'];
  if (headers['x-real-ip']) return headers['x-real-ip'];
  const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (xff) return xff.split(',')[0].trim();
  return null;
}

async function enrichIp(ip) {
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

function classifyByIspAsn(isp, asn) {
  const s = ((isp || '') + ' ' + (asn || '')).toLowerCase();
  const datacenterKeywords = ['amazon', 'google', 'digitalocean', 'ovh', 'hetzner', 'microsoft', 'azure', 'linode', 'cloudflare'];
  for (const k of datacenterKeywords) if (s.includes(k)) return 'datacenter';
  const mobileKeywords = ['vodafone', 'verizon', 'att', 'tmobile', 'claro', 'movistar', 'o2', 'telefonica', 'tim'];
  for (const k of mobileKeywords) if (s.includes(k)) return 'mobile';
  return 'residential';
}

function genVisitorId() {
  return uuidv4();
}

module.exports = { getClientIp, enrichIp, classifyByIspAsn, genVisitorId };
