// netlify/functions/getAlphaVolume.js
const axios = require('axios'); 

const TARGET_TOKENS = ['NIGHT', 'ARTX', 'DGRAM', 'KOGE', 'JCT', 'CYS', 'LAB'];
const LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list";
const KLINE_URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines";

exports.handler = async (event, context) => {
    try {
        const listResp = await axios.get(LIST_URL, { timeout: 10000 });
        const tokenMap = {};
        listResp.data.data.forEach(item => {
            if (TARGET_TOKENS.includes(item.symbol)) {
                tokenMap[item.symbol] = item.alphaId;
            }
        });

        const volumePromises = [];

        for (const [name, alpha_id] of Object.entries(tokenMap)) {
            const pair_symbol = `${alpha_id}USDT`;

            volumePromises.push(
                axios.get(KLINE_URL, { 
                    params: { symbol: pair_symbol, interval: "1d", limit: "1" },
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000 
                }).then(resp => {
                    if (resp.data.success && resp.data.data) {
                        const vol = parseFloat(resp.data.data[0][7]); 
                        return { [name]: vol };
                    }
                    return { [name]: 0 };
                }).catch(() => ({ [name]: 0 }))
            );
        }

        const volumeResults = await Promise.all(volumePromises);
        const finalData = volumeResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalData)
        };

    } catch (error) {
        console.error("Lỗi Serverless Function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Thất bại khi kết nối tới Binance." })
        };
    }
};
