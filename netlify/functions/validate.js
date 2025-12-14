// /.netlify/functions/validate.js
exports.handler = async (event) => {
    const key = event.queryStringParameters.key;
    
    if (!key) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Nenhuma key fornecida. Que merda.' })
        };
    }

    try {
        // Consulta F*****A e DESTRUTIVA à API da Work.ink
        const apiUrl = `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(key)}?deleteToken=1`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) throw new Error('Falha na API da Work.ink');
        
        const data = await response.json();
        
        // Resposta direta e sem frescura
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                valid: data.valid,
                message: data.valid ? '✅ Key válida e JÁ FOI CONSUMIDA.' : '❌ Key inválida ou já usada.'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Erro interno do caralho.', 
                details: error.message 
            })
        };
    }
};
