# Node.js 环境访问 Binance API 指南

## 🔍 问题分析

Chrome 扩展能成功访问 Binance API 的原因：
1. **扩展权限**：`host_permissions` 允许访问 `https://api.binance.com/*`
2. **自动 Cookie**：Chrome 自动携带用户已登录的 Binance cookie
3. **浏览器环境**：有完整的 HTTP 客户端功能

Node.js 环境访问失败的原因：
1. **无 Cookie**：没有用户登录的 Binance cookie
2. **网络限制**：可能被防火墙或网络策略阻止
3. **请求头缺失**：缺少必要的 HTTP 头信息

## 🛠️ 解决方案

### 方案1：使用正确的请求头（推荐）

Binance 的价格 API 实际上是公开的，不需要 cookie。关键是设置正确的请求头：

```javascript
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
};
```

### 方案2：使用代理

如果直接访问被阻止，可以使用代理：

```javascript
// 使用代理
const proxyUrl = 'http://your-proxy-server:port';
const result = await fetchPriceWithProxy('ETHUSDT', proxyUrl);
```

### 方案3：使用 VPN

如果在中国大陆，可能需要使用 VPN 来访问 Binance API。

## 📦 安装和使用

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```bash
npm test
```

或者直接运行：

```bash
node node_binance_api.js
```

### 3. 在代码中使用

```javascript
const { fetchPriceWithHttps, fetchPriceWithFetch, fetchPriceWithAxios } = require('./node_binance_api');

// 使用 https 模块
const price1 = await fetchPriceWithHttps('ETHUSDT');
console.log(`ETH价格: $${price1.price}`);

// 使用 fetch (Node.js 18+)
const price2 = await fetchPriceWithFetch('BTCUSDT');
console.log(`BTC价格: $${price2.price}`);

// 使用 axios
const price3 = await fetchPriceWithAxios('SOLUSDT');
console.log(`SOL价格: $${price3.price}`);
```

## 🔧 不同方案的对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| https 模块 | 无需额外依赖 | 代码较复杂 | 基础 Node.js 项目 |
| fetch | 现代 API，简洁 | 需要 Node.js 18+ | 现代 Node.js 项目 |
| axios | 功能丰富，易用 | 需要安装依赖 | 复杂项目 |

## 🚨 常见问题

### 1. 请求超时

```javascript
// 增加超时时间
const options = {
    timeout: 30000, // 30秒
    // ... 其他配置
};
```

### 2. 网络错误

```javascript
// 添加重试机制
async function fetchWithRetry(symbol, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetchPriceWithHttps(symbol);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

### 3. 频率限制

```javascript
// 添加请求间隔
async function fetchWithDelay(symbol) {
    const result = await fetchPriceWithHttps(symbol);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒间隔
    return result;
}
```

## 📊 API 响应格式

```json
{
    "symbol": "ETHUSDT",
    "price": "2500.50"
}
```

## 🔐 安全注意事项

1. **不要硬编码 API 密钥**：使用环境变量
2. **添加错误处理**：处理网络错误和 API 错误
3. **限制请求频率**：避免触发频率限制
4. **验证响应数据**：确保数据格式正确

## 🌐 其他可用的 API 端点

```javascript
// 24小时价格统计
GET /api/v3/ticker/24hr?symbol=ETHUSDT

// 最新成交价
GET /api/v3/ticker/price?symbol=ETHUSDT

// 深度信息
GET /api/v3/depth?symbol=ETHUSDT&limit=10

// K线数据
GET /api/v3/klines?symbol=ETHUSDT&interval=1m&limit=100
```

## 📝 示例：完整的监控脚本

```javascript
const { fetchPriceWithHttps } = require('./node_binance_api');

async function monitorPrice(symbol, interval = 5000) {
    console.log(`开始监控 ${symbol} 价格...`);
    
    setInterval(async () => {
        try {
            const data = await fetchPriceWithHttps(symbol);
            const price = parseFloat(data.price);
            const time = new Date().toLocaleTimeString();
            console.log(`[${time}] ${symbol}: $${price.toFixed(2)}`);
        } catch (error) {
            console.error(`获取 ${symbol} 价格失败:`, error.message);
        }
    }, interval);
}

// 监控多个币种
monitorPrice('ETHUSDT');
monitorPrice('BTCUSDT');
monitorPrice('SOLUSDT');
```

现在你可以在 Node.js 环境中成功访问 Binance API 了！ 