
const fetch = require('node-fetch');
const noblox = require('noblox.js');

exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { ids, cookie } = JSON.parse(event.body);
    
    if (!cookie) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No Roblox cookie provided' 
        })
      };
    }

    if (!ids || Object.keys(ids).length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No animation IDs provided' 
        })
      };
    }

    // Configurar noblox com o cookie
    await noblox.setCookie(cookie);
    const csrf = await noblox.getGeneralToken();

    const nameTab = ["SpoofedAnim", "Animation", "AnimSpoof"];
    const failedIDs = [];
    const results = {};

    // Processar cada animação
    for (const [name, id] of Object.entries(ids)) {
      try {
        console.log(`Processing ${name} (ID: ${id})`);
        
        // Pull animation
        const assetResponse = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`);
        const animationBlob = await assetResponse.blob();
        
        // Publish new animation
        const publishUrl = `https://www.roblox.com/ide/publish/uploadnewanimation` +
          `?assetTypeName=Animation` +
          `&name=${encodeURIComponent(`${nameTab[Math.floor(Math.random() * nameTab.length)]}_${Date.now()}`)}` +
          `&description=${encodeURIComponent('Spoofed Animation')}` +
          '&AllID=1' +
          '&ispublic=False' +
          '&allowComments=True' +
          '&isGamesAsset=False';

        const publishResponse = await fetch(publishUrl, {
          body: animationBlob,
          method: 'POST',
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie};`,
            'X-CSRF-Token': csrf,
            'User-Agent': 'RobloxStudio/WinInet',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Content-Type': 'application/octet-stream'
          }
        });

        if (publishResponse.ok) {
          const newId = await publishResponse.text();
          results[id] = newId;
          console.log(`✅ Spoofed ${id} -> ${newId}`);
        } else {
          throw new Error(`HTTP ${publishResponse.status}`);
        }
      } catch (e) {
        console.log(`❌ Failed ${id}:`, e);
        failedIDs.push(id);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: failedIDs.length === 0,
        spoofed_count: Object.keys(results).length,
        failed_count: failedIDs.length,
        results: results,
        failed: failedIDs,
        message: `Spoofed ${Object.keys(results).length} animations, failed: ${failedIDs.length}`
      })
    };

  } catch (error) {
    console.error('Netlify function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
