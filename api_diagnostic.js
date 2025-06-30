// API诊断工具
class APIDiagnostic {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }
    
    // 添加测试结果
    addResult(test, success, data, error) {
        this.results.push({
            test,
            success,
            data,
            error,
            timestamp: Date.now()
        });
    }
    
    // 测试基础连接
    async testBasicConnection() {
        console.log('🔍 测试基础连接...');
        
        try {
            const startTime = Date.now();
            const response = await fetch('https://api.binance.com/api/v3/ping');
            const endTime = Date.now();
            
            if (response.ok) {
                const data = await response.json();
                this.addResult('基础连接', true, {
                    status: response.status,
                    responseTime: endTime - startTime,
                    data: data
                });
                console.log('✅ 基础连接成功');
                return true;
            } else {
                this.addResult('基础连接', false, null, {
                    status: response.status,
                    statusText: response.statusText
                });
                console.log('❌ 基础连接失败');
                return false;
            }
        } catch (error) {
            this.addResult('基础连接', false, null, {
                message: error.message,
                name: error.name
            });
            console.log('❌ 基础连接错误:', error.message);
            return false;
        }
    }
    
    // 测试价格API
    async testPriceAPI(symbol = 'ETHUSDT') {
        console.log(`🔍 测试价格API: ${symbol}`);
        
        try {
            const startTime = Date.now();
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            const endTime = Date.now();
            
            if (response.ok) {
                const data = await response.json();
                this.addResult('价格API', true, {
                    symbol: symbol,
                    status: response.status,
                    responseTime: endTime - startTime,
                    data: data
                });
                console.log(`✅ 价格API成功: ${symbol} = $${data.price}`);
                return data;
            } else {
                this.addResult('价格API', false, null, {
                    symbol: symbol,
                    status: response.status,
                    statusText: response.statusText
                });
                console.log(`❌ 价格API失败: ${symbol}`);
                return null;
            }
        } catch (error) {
            this.addResult('价格API', false, null, {
                symbol: symbol,
                message: error.message,
                name: error.name
            });
            console.log(`❌ 价格API错误: ${symbol}`, error.message);
            return null;
        }
    }
    
    // 测试多个币种
    async testMultipleCoins(symbols = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT']) {
        console.log(`🔍 测试多个币种: ${symbols.join(', ')}`);
        
        const results = [];
        for (const symbol of symbols) {
            const result = await this.testPriceAPI(symbol);
            results.push({ symbol, result });
        }
        
        return results;
    }
    
    // 测试CORS问题
    async testCORS() {
        console.log('🔍 测试CORS问题...');
        
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.addResult('CORS测试', true, {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries())
                });
                console.log('✅ CORS测试通过');
                return true;
            } else {
                this.addResult('CORS测试', false, null, {
                    status: response.status,
                    statusText: response.statusText
                });
                console.log('❌ CORS测试失败');
                return false;
            }
        } catch (error) {
            this.addResult('CORS测试', false, null, {
                message: error.message,
                name: error.name
            });
            console.log('❌ CORS测试错误:', error.message);
            return false;
        }
    }
    
    // 测试网络延迟
    async testNetworkLatency() {
        console.log('🔍 测试网络延迟...');
        
        const latencies = [];
        const testCount = 5;
        
        for (let i = 0; i < testCount; i++) {
            try {
                const startTime = Date.now();
                const response = await fetch('https://api.binance.com/api/v3/ping');
                const endTime = Date.now();
                
                if (response.ok) {
                    latencies.push(endTime - startTime);
                }
            } catch (error) {
                console.log(`延迟测试 ${i + 1} 失败:`, error.message);
            }
            
            // 等待100ms再进行下一次测试
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (latencies.length > 0) {
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            const minLatency = Math.min(...latencies);
            const maxLatency = Math.max(...latencies);
            
            this.addResult('网络延迟', true, {
                average: avgLatency,
                min: minLatency,
                max: maxLatency,
                samples: latencies
            });
            
            console.log(`✅ 网络延迟测试完成: 平均${avgLatency.toFixed(0)}ms (${minLatency}-${maxLatency}ms)`);
            return { average: avgLatency, min: minLatency, max: maxLatency };
        } else {
            this.addResult('网络延迟', false, null, { message: '所有延迟测试都失败' });
            console.log('❌ 网络延迟测试失败');
            return null;
        }
    }
    
    // 运行完整诊断
    async runFullDiagnostic() {
        console.log('🚀 开始API诊断...');
        
        // 1. 基础连接测试
        await this.testBasicConnection();
        
        // 2. CORS测试
        await this.testCORS();
        
        // 3. 网络延迟测试
        await this.testNetworkLatency();
        
        // 4. 价格API测试
        await this.testPriceAPI('ETHUSDT');
        
        // 5. 多币种测试
        await this.testMultipleCoins();
        
        // 6. 生成报告
        this.generateReport();
    }
    
    // 生成诊断报告
    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const successCount = this.results.filter(r => r.success).length;
        const totalCount = this.results.length;
        
        console.log('\n📊 API诊断报告');
        console.log('='.repeat(50));
        console.log(`总测试数: ${totalCount}`);
        console.log(`成功数: ${successCount}`);
        console.log(`失败数: ${totalCount - successCount}`);
        console.log(`成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
        console.log(`总耗时: ${totalTime}ms`);
        console.log('\n详细结果:');
        
        this.results.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.test}`);
            
            if (result.success && result.data) {
                if (result.data.responseTime) {
                    console.log(`   响应时间: ${result.data.responseTime}ms`);
                }
                if (result.data.data && result.data.data.price) {
                    console.log(`   价格: $${result.data.data.price}`);
                }
            }
            
            if (!result.success && result.error) {
                console.log(`   错误: ${result.error.message || result.error.statusText || JSON.stringify(result.error)}`);
            }
        });
        
        // 提供建议
        this.provideRecommendations();
    }
    
    // 提供建议
    provideRecommendations() {
        console.log('\n💡 建议:');
        
        const failedTests = this.results.filter(r => !r.success);
        
        if (failedTests.length === 0) {
            console.log('✅ 所有测试都通过了！API连接正常。');
            return;
        }
        
        failedTests.forEach(test => {
            switch (test.test) {
                case '基础连接':
                    console.log('🔧 基础连接失败 - 检查网络连接和防火墙设置');
                    break;
                case 'CORS测试':
                    console.log('🔧 CORS问题 - 检查浏览器扩展权限');
                    break;
                case '网络延迟':
                    console.log('🔧 网络延迟过高 - 考虑使用代理或VPN');
                    break;
                case '价格API':
                    console.log('🔧 价格API失败 - 检查API端点是否正确');
                    break;
            }
        });
        
        console.log('\n🛠️ 可能的解决方案:');
        console.log('1. 检查网络连接');
        console.log('2. 检查防火墙设置');
        console.log('3. 尝试使用VPN');
        console.log('4. 检查浏览器扩展权限');
        console.log('5. 清除浏览器缓存');
    }
}

// 导出诊断工具
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIDiagnostic;
} else if (typeof window !== 'undefined') {
    window.APIDiagnostic = APIDiagnostic;
}

// 如果直接运行，执行诊断
if (typeof window !== 'undefined') {
    console.log('🔧 API诊断工具已加载');
    console.log('使用方法: const diagnostic = new APIDiagnostic(); diagnostic.runFullDiagnostic();');
} 