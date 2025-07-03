const BinanceWebSocketAPI = require('./binance_websocket_test');

class ContinuousPriceMonitor {
    constructor(symbols = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT']) {
        this.symbols = symbols;
        this.ws = new BinanceWebSocketAPI();
        this.monitoring = false;
        this.priceHistory = new Map();
    }

    // 启动持续监控
    async start() {
        try {
            console.log('🚀 启动持续价格监控...');
            console.log(`监控币种: ${this.symbols.join(', ')}`);
            console.log('='.repeat(60));
            
            await this.ws.connect();
            this.monitoring = true;
            
            // 立即获取一次所有价格
            await this.fetchAllPrices();
            
            // 设置定时获取价格
            this.priceInterval = setInterval(async () => {
                if (this.monitoring) {
                    await this.fetchAllPrices();
                }
            }, 3000); // 每3秒获取一次
            
            console.log('✅ 监控已启动，按 Ctrl+C 停止\n');
            
        } catch (error) {
            console.error('❌ 启动监控失败:', error.message);
            this.stop();
        }
    }

    // 获取所有价格
    async fetchAllPrices() {
        const promises = this.symbols.map(symbol => this.fetchPrice(symbol));
        await Promise.allSettled(promises);
    }

    // 获取单个价格
    async fetchPrice(symbol) {
        try {
            const price = await this.ws.getPrice(symbol);
            const currentPrice = parseFloat(price.price);
            const timestamp = Date.now();
            
            // 更新价格历史
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
            }
            
            const history = this.priceHistory.get(symbol);
            history.push({
                price: currentPrice,
                timestamp: timestamp
            });
            
            // 保持最近50个数据点
            if (history.length > 50) {
                history.shift();
            }
            
            // 计算价格变化
            const priceChange = this.calculatePriceChange(symbol);
            
            // 显示价格信息
            this.displayPrice(symbol, currentPrice, priceChange);
            
        } catch (error) {
            console.error(`❌ 获取 ${symbol} 价格失败:`, error.message);
        }
    }

    // 计算价格变化
    calculatePriceChange(symbol) {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 2) {
            return { change: 0, changePercent: 0 };
        }
        
        const current = history[history.length - 1].price;
        const previous = history[history.length - 2].price;
        const change = current - previous;
        const changePercent = (change / previous) * 100;
        
        return { change, changePercent };
    }

    // 显示价格信息
    displayPrice(symbol, price, priceChange) {
        const time = new Date().toLocaleTimeString();
        const change = priceChange.change;
        const changePercent = priceChange.changePercent;
        
        let changeText = '';
        let emoji = '';
        
        if (change > 0) {
            changeText = `+${change.toFixed(4)} (+${changePercent.toFixed(2)}%)`;
            emoji = '📈';
        } else if (change < 0) {
            changeText = `${change.toFixed(4)} (${changePercent.toFixed(2)}%)`;
            emoji = '📉';
        } else {
            changeText = `0.0000 (0.00%)`;
            emoji = '➡️';
        }
        
        // 格式化价格显示
        let priceDisplay = '';
        if (price >= 1000) {
            priceDisplay = `$${price.toFixed(2)}`;
        } else if (price >= 100) {
            priceDisplay = `$${price.toFixed(3)}`;
        } else {
            priceDisplay = `$${price.toFixed(4)}`;
        }
        
        console.log(`[${time}] ${emoji} ${symbol}: ${priceDisplay} ${changeText}`);
    }

    // 获取24小时统计
    async get24hrStats(symbol) {
        try {
            const ticker = await this.ws.get24hrTicker(symbol);
            return {
                symbol: ticker.symbol,
                price: parseFloat(ticker.lastPrice),
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                volume: parseFloat(ticker.volume),
                highPrice: parseFloat(ticker.highPrice),
                lowPrice: parseFloat(ticker.lowPrice)
            };
        } catch (error) {
            console.error(`❌ 获取 ${symbol} 24小时统计失败:`, error.message);
            return null;
        }
    }

    // 显示24小时统计
    async show24hrStats() {
        console.log('\n📊 24小时统计信息:');
        console.log('='.repeat(60));
        
        for (const symbol of this.symbols) {
            const stats = await this.get24hrStats(symbol);
            if (stats) {
                const emoji = stats.priceChangePercent >= 0 ? '📈' : '📉';
                console.log(`${emoji} ${stats.symbol}:`);
                console.log(`  当前价格: $${stats.price.toFixed(4)}`);
                console.log(`  24h变化: ${stats.priceChange >= 0 ? '+' : ''}${stats.priceChange.toFixed(4)} (${stats.priceChangePercent >= 0 ? '+' : ''}${stats.priceChangePercent.toFixed(2)}%)`);
                console.log(`  24h最高: $${stats.highPrice.toFixed(4)}`);
                console.log(`  24h最低: $${stats.lowPrice.toFixed(4)}`);
                console.log(`  24h成交量: ${stats.volume.toFixed(2)}`);
                console.log('');
            }
        }
    }

    // 停止监控
    stop() {
        console.log('\n🛑 停止监控...');
        this.monitoring = false;
        
        if (this.priceInterval) {
            clearInterval(this.priceInterval);
            this.priceInterval = null;
        }
        
        this.ws.close();
        console.log('✅ 监控已停止');
    }
}

// 主函数
async function main() {
    const monitor = new ContinuousPriceMonitor(['ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
    
    // 处理退出信号
    process.on('SIGINT', async () => {
        console.log('\n\n📊 显示24小时统计...');
        await monitor.show24hrStats();
        monitor.stop();
        process.exit(0);
    });
    
    // 启动监控
    await monitor.start();
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ContinuousPriceMonitor; 