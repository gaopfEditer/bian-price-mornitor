const https = require('https');
const http = require('http');

// 方案1: 使用 https 模块直接请求
function fetchPriceWithHttps(symbol = 'ETHUSDT') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.binance.com',
            port: 443,
            path: `/api/v3/ticker/price?symbol=${symbol}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            }
        };

        const req = https.request(options, (res) => {
            console.log(`状态码: ${res.statusCode}`);
            console.log(`响应头:`, res.headers);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log('响应数据:', jsonData);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`JSON解析失败: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

// 方案2: 使用 fetch (Node.js 18+)
async function fetchPriceWithFetch(symbol = 'ETHUSDT') {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('响应数据:', data);
        return data;
    } catch (error) {
        throw new Error(`请求失败: ${error.message}`);
    }
}

// 方案3: 使用 axios (需要安装: npm install axios)
async function fetchPriceWithAxios(symbol = 'ETHUSDT') {
    try {
        const axios = require('axios');
        
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price`, {
            params: { symbol },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });

        console.log('响应数据:', response.data);
        return response.data;
    } catch (error) {
        throw new Error(`请求失败: ${error.message}`);
    }
}

// 方案4: 如果需要使用代理
function fetchPriceWithProxy(symbol = 'ETHUSDT', proxyUrl = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.binance.com',
            port: 443,
            path: `/api/v3/ticker/price?symbol=${symbol}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            }
        };

        // 如果有代理设置
        if (proxyUrl) {
            const url = new URL(proxyUrl);
            options.hostname = url.hostname;
            options.port = url.port || 80;
            options.path = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
        }

        const client = proxyUrl ? http : https;
        const req = client.request(options, (res) => {
            console.log(`状态码: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log('响应数据:', jsonData);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`JSON解析失败: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

// 测试函数
async function testAllMethods() {
    const symbols = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT'];
    
    console.log('=== 测试 Binance API 访问 ===\n');
    
    for (const symbol of symbols) {
        console.log(`\n--- 测试 ${symbol} ---`);
        
        try {
            console.log('1. 使用 https 模块:');
            const result1 = await fetchPriceWithHttps(symbol);
            console.log(`✅ 成功: $${parseFloat(result1.price).toFixed(2)}`);
        } catch (error) {
            console.log(`❌ 失败: ${error.message}`);
        }
        
        try {
            console.log('2. 使用 fetch (Node.js 18+):');
            const result2 = await fetchPriceWithFetch(symbol);
            console.log(`✅ 成功: $${parseFloat(result2.price).toFixed(2)}`);
        } catch (error) {
            console.log(`❌ 失败: ${error.message}`);
        }
        
        try {
            console.log('3. 使用 axios:');
            const result3 = await fetchPriceWithAxios(symbol);
            console.log(`✅ 成功: $${parseFloat(result3.price).toFixed(2)}`);
        } catch (error) {
            console.log(`❌ 失败: ${error.message}`);
        }
    }
}

// 如果直接运行此文件
if (require.main === module) {
    testAllMethods().catch(console.error);
}

module.exports = {
    fetchPriceWithHttps,
    fetchPriceWithFetch,
    fetchPriceWithAxios,
    fetchPriceWithProxy
}; 