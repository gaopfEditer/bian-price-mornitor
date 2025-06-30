// 改进的后台服务脚本
let monitoringInterval = null;
let lastPrices = {};
let debugMode = false;
let currentCoin = 'ETHUSDT';
let volatilityData = {};
let popupConnected = false;
let retryCount = 0;
let maxRetries = 3;
let retryDelay = 2000; // 2秒

// 调试日志函数
function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (debugMode) {
        chrome.runtime.sendMessage({
            action: 'debugLog',
            message: logMessage,
            type: type
        }).catch(() => {
            // 忽略发送失败的错误
        });
    }
}

// 初始化
chrome.runtime.onInstalled.addListener(function() {
    debugLog('多币种价格监控器已安装', 'success');
    // 测试API连接
    testAPIConnection();
});

// 测试API连接
async function testAPIConnection() {
    debugLog('测试API连接...', 'info');
    
    try {
        // 首先测试ping接口
        const pingResponse = await fetch('https://api.binance.com/api/v3/ping', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (pingResponse.ok) {
            debugLog('API连接测试成功', 'success');
            return true;
        } else {
            debugLog(`API连接测试失败: ${pingResponse.status}`, 'error');
            return false;
        }
    } catch (error) {
        debugLog(`API连接测试错误: ${error.message}`, 'error');
        return false;
    }
}

// 监听popup连接状态
chrome.runtime.onConnect.addListener(function(port) {
    debugLog('Popup已连接', 'info');
    popupConnected = true;
    
    port.onDisconnect.addListener(function() {
        debugLog('Popup已断开连接', 'info');
        popupConnected = false;
    });
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    debugLog(`收到消息: ${JSON.stringify(request)}`, 'info');
    
    if (request.action === 'startMonitoring') {
        currentCoin = request.coin || 'ETHUSDT';
        startMonitoring();
        sendResponse({status: 'success', message: '监控已启动', coin: currentCoin});
    } else if (request.action === 'stopMonitoring') {
        stopMonitoring();
        sendResponse({status: 'success', message: '监控已停止'});
    } else if (request.action === 'switchCoin') {
        const newCoin = request.coin;
        debugLog(`切换币种: ${currentCoin} -> ${newCoin}`, 'info');
        
        currentCoin = newCoin;
        
        if (monitoringInterval) {
            debugLog('重新启动监控以使用新币种', 'info');
            startMonitoring();
        }
        
        sendResponse({status: 'success', message: '币种已切换', coin: currentCoin});
    } else if (request.action === 'updateVolatility') {
        volatilityData[request.coin] = {
            volatility: request.volatility,
            avgPrice: request.avgPrice,
            timestamp: new Date().toISOString()
        };
        debugLog(`更新波动率: ${request.coin} - ${request.volatility.toFixed(2)}%`, 'info');
    } else if (request.action === 'volatilityAlert') {
        handleVolatilityAlert(request);
    } else if (request.action === 'debug') {
        debugMode = true;
        debugLog('调试模式已开启', 'info');
        sendResponse({
            status: 'success',
            message: '调试模式已开启',
            data: {
                monitoringInterval: !!monitoringInterval,
                currentCoin: currentCoin,
                lastPrices: lastPrices,
                volatilityData: volatilityData,
                debugMode: debugMode,
                popupConnected: popupConnected,
                retryCount: retryCount
            }
        });
    } else if (request.action === 'getStatus') {
        sendResponse({
            status: 'success',
            data: {
                monitoringInterval: !!monitoringInterval,
                currentCoin: currentCoin,
                lastPrices: lastPrices,
                volatilityData: volatilityData,
                debugMode: debugMode,
                popupConnected: popupConnected,
                retryCount: retryCount,
                timestamp: new Date().toISOString()
            }
        });
    } else if (request.action === 'testAPI') {
        testAPIConnection().then(success => {
            sendResponse({status: 'success', apiWorking: success});
        });
        return true; // 异步响应
    }
    
    return true;
});

// 启动监控
function startMonitoring() {
    debugLog(`启动价格监控，币种: ${currentCoin}`, 'info');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        debugLog('清除旧的监控定时器', 'info');
    }
    
    // 重置重试计数
    retryCount = 0;
    
    // 立即获取一次价格并发送到popup
    fetchPriceWithRetry().then(() => {
        debugLog('初始价格已发送到popup', 'success');
    }).catch(error => {
        debugLog(`初始价格获取失败: ${error.message}`, 'error');
    });
    
    // 每5秒获取一次价格
    monitoringInterval = setInterval(() => {
        debugLog('定时获取价格', 'info');
        fetchPriceWithRetry();
    }, 5000);
    
    debugLog('监控定时器已设置，间隔5秒', 'success');
}

// 停止监控
function stopMonitoring() {
    debugLog('停止价格监控', 'info');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        debugLog('监控定时器已清除', 'success');
    } else {
        debugLog('没有活动的监控定时器', 'warning');
    }
    
    // 重置重试计数
    retryCount = 0;
}

// 带重试的价格获取
async function fetchPriceWithRetry() {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            debugLog(`尝试获取价格 (第${attempt}次)`, 'info');
            const price = await fetchPrice();
            retryCount = 0; // 成功后重置重试计数
            return price;
        } catch (error) {
            debugLog(`第${attempt}次尝试失败: ${error.message}`, 'error');
            
            if (attempt < maxRetries) {
                debugLog(`等待${retryDelay}ms后重试...`, 'info');
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay *= 1.5; // 指数退避
            } else {
                debugLog('所有重试都失败了', 'error');
                retryCount++;
                throw error;
            }
        }
    }
}

// 获取价格
function fetchPrice() {
    debugLog(`开始获取${currentCoin}价格`, 'info');
    
    return fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentCoin}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cache-Control': 'no-cache'
        },
        // 添加超时设置
        signal: AbortSignal.timeout(10000) // 10秒超时
    })
    .then(response => {
        debugLog(`API响应状态: ${response.status}`, 'info');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        const currentPrice = parseFloat(data.price);
        debugLog(`获取到价格: $${currentPrice}`, 'success');
        
        // 更新最后价格
        lastPrices[currentCoin] = currentPrice;
        
        // 更新badge显示价格
        updateBadge(currentPrice);
        
        // 发送价格更新到popup
        const message = {
            action: 'updatePrice',
            price: currentPrice.toFixed(2),
            coin: currentCoin,
            timestamp: new Date().toISOString()
        };
        
        debugLog(`发送价格更新消息: ${JSON.stringify(message)}`, 'info');
        
        chrome.runtime.sendMessage(message).then(() => {
            debugLog('价格更新消息发送成功', 'success');
        }).catch(error => {
            debugLog(`价格更新消息发送失败: ${error.message}`, 'error');
        });
        
        return currentPrice;
    })
    .catch(error => {
        debugLog(`获取价格失败: ${error.message}`, 'error');
        updateBadge('Error');
        
        // 发送错误信息到popup
        const errorMessage = {
            action: 'priceError',
            error: error.message,
            coin: currentCoin,
            timestamp: new Date().toISOString()
        };
        
        chrome.runtime.sendMessage(errorMessage).catch(() => {
            // 忽略发送失败的错误
        });
        
        throw error;
    });
}

// 处理波动率提醒
function handleVolatilityAlert(request) {
    const { coin, volatility, level, threshold, multiplier, message } = request;
    
    debugLog(`处理波动率提醒: ${coin} - ${volatility.toFixed(2)}% (${level}星, 阈值${threshold}%的${multiplier.toFixed(1)}倍)`, 'info');
    
    const notificationConfig = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `${coin} 波动率提醒`,
        message: message,
        priority: level
    };
    
    chrome.notifications.create({
        ...notificationConfig,
        requireInteraction: level >= 3,
        silent: level < 2
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            debugLog(`通知创建失败: ${chrome.runtime.lastError.message}`, 'error');
        } else {
            debugLog(`波动率通知创建成功，ID: ${notificationId}，级别: ${level}，倍数: ${multiplier.toFixed(1)}`, 'success');
        }
    });
    
    chrome.runtime.sendMessage({
        action: 'volatilityAlert',
        title: notificationConfig.title,
        message: message,
        level: level,
        coin: coin,
        volatility: volatility,
        threshold: threshold,
        multiplier: multiplier
    }).catch(() => {
        // 忽略发送失败的错误
    });
}

// 检查价格提醒
function checkPriceAlerts(currentPrice) {
    debugLog(`检查价格提醒，当前价格: $${currentPrice}`, 'info');
    
    chrome.storage.local.get(['priceAlerts'], function(result) {
        const alerts = result.priceAlerts || [];
        debugLog(`找到 ${alerts.length} 个价格提醒`, 'info');
        
        let triggeredAlerts = [];
        
        alerts.forEach((alert, index) => {
            const alertPrice = parseFloat(alert.price);
            debugLog(`检查提醒 ${index + 1}: ${alert.type} $${alertPrice}`, 'info');
            
            if (alert.type === 'above' && currentPrice >= alertPrice) {
                debugLog(`触发提醒: 价格 ${currentPrice} >= ${alertPrice}`, 'success');
                triggeredAlerts.push({
                    index: index,
                    alert: alert,
                    message: `${currentCoin}价格已达到 $${alertPrice}，当前价格: $${currentPrice.toFixed(2)}`
                });
            } else if (alert.type === 'below' && currentPrice <= alertPrice) {
                debugLog(`触发提醒: 价格 ${currentPrice} <= ${alertPrice}`, 'success');
                triggeredAlerts.push({
                    index: index,
                    alert: alert,
                    message: `${currentCoin}价格已降至 $${alertPrice}，当前价格: $${currentPrice.toFixed(2)}`
                });
            }
        });
        
        triggeredAlerts.forEach(triggered => {
            debugLog(`发送通知: ${triggered.message}`, 'info');
            showNotification(triggered.message);
        });
        
        triggeredAlerts.reverse().forEach(triggered => {
            alerts.splice(triggered.index, 1);
            debugLog(`移除已触发的提醒: ${triggered.alert.type} $${triggered.alert.price}`, 'info');
        });
        
        chrome.storage.local.set({priceAlerts: alerts}, () => {
            debugLog(`保存更新后的提醒列表，剩余 ${alerts.length} 个提醒`, 'info');
        });
    });
}

// 显示通知
function showNotification(message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '价格提醒',
        message: message
    });
}

// 更新badge
function updateBadge(price) {
    if (typeof price === 'number') {
        chrome.action.setBadgeText({
            text: price.toFixed(0)
        });
        chrome.action.setBadgeBackgroundColor({
            color: '#4CAF50'
        });
    } else {
        chrome.action.setBadgeText({
            text: 'Err'
        });
        chrome.action.setBadgeBackgroundColor({
            color: '#f44336'
        });
    }
}

// 定期清理旧数据
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // 清理超过1小时的波动率数据
    Object.keys(volatilityData).forEach(coin => {
        if (new Date(volatilityData[coin].timestamp).getTime() < oneHourAgo) {
            delete volatilityData[coin];
            debugLog(`清理过期的波动率数据: ${coin}`, 'info');
        }
    });
}, 30 * 60 * 1000); // 每30分钟清理一次

debugLog('改进版后台服务脚本已加载', 'success'); 