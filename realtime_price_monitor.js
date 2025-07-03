const BinanceWebSocketAPI = require('./binance_websocket_test');

class RealtimePriceMonitor {
    constructor(symbols = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT']) {
        this.symbols = symbols;
        this.ws = new BinanceWebSocketAPI(false);
        this.priceHistory = new Map();
        this.monitoring = false;
    }

    // 启动监控
    async start() {
        try {
            console.log('🚀 启动实时价格监控...');
            console.log(`监控币种: ${this.symbols.join(', ')}`);
            
            await this.ws.connect();
            this.monitoring = true;
            
            // 立即获取一次价格
            await this.fetchAllPrices();
            
            // 设置定时获取价格
            this.priceInterval = setInterval(async () => {
                if (this.monitoring) {
                    await this.fetchAllPrices();
                }
            }, 5000); // 每5秒获取一次
            
            console.log('✅ 监控已启动，按 Ctrl+C 停止');
            
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
            
            // 保持最近100个数据点
            if (history.length > 100) {
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
        if (change > 0) {
            changeText = `📈 +${change.toFixed(2)} (+${changePercent.toFixed(2)}%)`;
        } else if (change < 0) {
            changeText = `📉 ${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
        } else {
            changeText = `➡️ 0.00 (0.00%)`;
        }
        
        console.log(`[${time}] ${symbol}: $${price.toFixed(2)} ${changeText}`);
    }

    // 获取价格统计
    getPriceStats(symbol) {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length === 0) {
            return null;
        }
        
        const prices = history.map(h => h.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const current = prices[prices.length - 1];
        
        return {
            symbol,
            current,
            min,
            max,
            avg,
            dataPoints: history.length
        };
    }

    // 显示统计信息
    showStats() {
        console.log('\n📊 价格统计信息:');
        console.log('='.repeat(50));
        
        this.symbols.forEach(symbol => {
            const stats = this.getPriceStats(symbol);
            if (stats) {
                console.log(`${symbol}:`);
                console.log(`  当前: $${stats.current.toFixed(2)}`);
                console.log(`  最高: $${stats.max.toFixed(2)}`);
                console.log(`  最低: $${stats.min.toFixed(2)}`);
                console.log(`  平均: $${stats.avg.toFixed(2)}`);
                console.log(`  数据点: ${stats.dataPoints}`);
                console.log('');
            }
        });
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
    const monitor = new RealtimePriceMonitor(['ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
    
    // 处理退出信号
    process.on('SIGINT', () => {
        monitor.showStats();
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

module.exports = RealtimePriceMonitor; 