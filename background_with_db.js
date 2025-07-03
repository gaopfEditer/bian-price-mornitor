// 后台服务脚本 - 直接WebSocket推送
let monitoringInterval = null;
let lastPrices = {};
let debugMode = false;
let currentCoin = 'ETHUSDT';
let volatilityData = {};
let popupConnected = false; // 跟踪popup连接状态
let wsUrl = 'ws://1.94.137.69:7001'; // WebSocket服务地址

// 调试日志函数
function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    // 如果开启了调试模式，可以发送到popup
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
    debugLog('后台将通过HTTP API发送价格数据到Socket.IO服务器', 'info');
    // 不自动启动监控，等待用户手动启动
});

// 使用HTTP API推送消息到Socket.IO服务器
async function pushPriceToWebSocket(symbol, price, timestamp) {
    try {
        const response = await fetch('http://1.94.137.69:7001/api/send-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'price_update',
                symbol: symbol,
                price: price,
                timestamp: timestamp,
                source: 'chrome_extension'
            })
        });
        
        if (response.ok) {
            debugLog(`价格数据推送成功: ${symbol} - $${price}`, 'success');
            return true;
        } else {
            debugLog(`价格数据推送失败: HTTP ${response.status}`, 'warning');
            return false;
        }
    } catch (error) {
        debugLog(`价格数据推送失败: ${error.message}`, 'warning');
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
        // 处理币种切换
        const newCoin = request.coin;
        debugLog(`切换币种: ${currentCoin} -> ${newCoin}`, 'info');
        
        currentCoin = newCoin;
        
        // 如果正在监控，重新启动监控以使用新币种
        if (monitoringInterval) {
            debugLog('重新启动监控以使用新币种', 'info');
            startMonitoring();
        }
        
        sendResponse({status: 'success', message: '币种已切换', coin: currentCoin});
    } else if (request.action === 'updateVolatility') {
        // 更新波动率数据
        volatilityData[request.coin] = {
            volatility: request.volatility,
            avgPrice: request.avgPrice,
            timestamp: new Date().toISOString()
        };
        debugLog(`更新波动率: ${request.coin} - ${request.volatility.toFixed(2)}%`, 'info');
    } else if (request.action === 'volatilityAlert') {
        // 处理波动率提醒
        handleVolatilityAlert(request);

    } else if (request.action === 'debug') {
        // 调试消息处理
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
                wsUrl: wsUrl
            }
        });
    } else if (request.action === 'getStatus') {
        // 获取状态信息
        sendResponse({
            status: 'success',
            data: {
                monitoringInterval: !!monitoringInterval,
                currentCoin: currentCoin,
                lastPrices: lastPrices,
                volatilityData: volatilityData,
                debugMode: debugMode,
                popupConnected: popupConnected,
                wsUrl: wsUrl,
                timestamp: new Date().toISOString()
            }
        });
    }
    
    return true; // 保持消息通道开放
});



// 启动监控
function startMonitoring() {
    debugLog(`启动价格监控，币种: ${currentCoin}`, 'info');
    debugLog('后台将持续运行，每5秒获取价格并推送到WebSocket', 'info');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        debugLog('清除旧的监控定时器', 'info');
    }
    
    // 立即获取一次价格
    fetchPrice().then(() => {
        debugLog('初始价格获取完成', 'success');
    }).catch(error => {
        debugLog(`初始价格获取失败: ${error.message}`, 'error');
    });
    
    // 每5秒获取一次价格
    monitoringInterval = setInterval(() => {
        debugLog('定时获取价格', 'info');
        fetchPrice();
    }, 5000);
    
    debugLog('监控定时器已设置，间隔5秒，后台将持续运行', 'success');
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
}

// 获取价格
function fetchPrice() {
    debugLog(`开始获取${currentCoin}价格`, 'info');
    
    return fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentCoin}`)
        .then(response => {
            debugLog(`API响应状态: ${response.status}`, 'info');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(data => {
            const currentPrice = parseFloat(data.price);
            const timestamp = new Date().toISOString();
            
            debugLog(`获取到价格: $${currentPrice}`, 'success');
            
            // 更新最后价格
            lastPrices[currentCoin] = currentPrice;
            
            // 更新badge显示价格
            updateBadge(currentPrice);
            
            // 立即推送数据到WebSocket
            pushPriceToWebSocket(currentCoin, currentPrice, timestamp);
            
            // 发送价格更新到popup（可选，不影响WebSocket）
            const message = {
                action: 'updatePrice',
                price: currentPrice.toFixed(2),
                coin: currentCoin,
                timestamp: timestamp
            };
            
            debugLog(`准备发送价格更新消息到popup: ${JSON.stringify(message)}`, 'info');
            
            // 尝试发送到popup，但不影响主流程
            chrome.runtime.sendMessage(message).then(() => {
                debugLog('价格更新消息发送到popup成功', 'success');
            }).catch(error => {
                // 这是正常的，因为popup可能没有打开
                debugLog(`价格更新消息发送到popup失败（正常）: ${error.message}`, 'info');
            });
            
            return currentPrice;
        })
        .catch(error => {
            debugLog(`获取价格失败: ${error.message}`, 'error');
            updateBadge('Error');
            
            // 发送错误信息到popup（可选）
            const errorMessage = {
                action: 'priceError',
                error: error.message,
                coin: currentCoin,
                timestamp: new Date().toISOString()
            };
            
            chrome.runtime.sendMessage(errorMessage).catch(() => {
                // 忽略发送失败的错误，这是正常的
                debugLog('错误信息发送到popup失败（正常）', 'info');
            });
            
            throw error;
        });
}

// 处理波动率提醒
function handleVolatilityAlert(request) {
    const { coin, volatility, level, threshold, multiplier, message } = request;
    
    debugLog(`处理波动率提醒: ${coin} - ${volatility.toFixed(2)}% (${level}星, 阈值${threshold}%的${multiplier.toFixed(1)}倍)`, 'info');
    
    // 根据级别设置不同的通知样式
    const notificationConfig = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `${coin} 波动率提醒`,
        message: message,
        priority: level // 使用级别作为优先级
    };
    
    // 创建通知
    chrome.notifications.create({
        ...notificationConfig,
        requireInteraction: level >= 3, // 3级以上需要用户交互
        silent: level < 2 // 1级静音
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            debugLog(`通知创建失败: ${chrome.runtime.lastError.message}`, 'error');
        } else {
            debugLog(`波动率通知创建成功，ID: ${notificationId}，级别: ${level}，倍数: ${multiplier.toFixed(1)}`, 'success');
        }
    });
    
    // 发送到popup显示（可选）
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
        // 忽略发送失败的错误，这是正常的
        debugLog('波动率提醒发送到popup失败（正常）', 'info');
    });
}

// 更新badge
function updateBadge(price) {
    if (typeof price === 'number') {
        // 显示价格（去掉小数点后的0）
        const displayPrice = price.toFixed(2).replace(/\.?0+$/, '');
        chrome.action.setBadgeText({text: displayPrice});
        chrome.action.setBadgeBackgroundColor({color: '#4CAF50'});
        debugLog(`更新badge: ${displayPrice}`, 'info');
    } else {
        chrome.action.setBadgeText({text: 'Err'});
        chrome.action.setBadgeBackgroundColor({color: '#f44336'});
        debugLog('更新badge: Error', 'error');
    }
}

// 处理通知点击
chrome.notifications.onClicked.addListener(function(notificationId) {
    debugLog(`通知被点击: ${notificationId}`, 'info');
});

// 处理通知关闭
chrome.notifications.onClosed.addListener(function(notificationId, byUser) {
    debugLog(`通知已关闭: ${notificationId}, 用户操作: ${byUser}`, 'info');
});

// 错误处理
chrome.runtime.onSuspend.addListener(function() {
    debugLog('扩展即将挂起，清理资源', 'warning');
    stopMonitoring();
});

// 发送心跳消息
async function sendHeartbeat() {
    try {
        const response = await fetch('http://1.94.137.69:7001/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'heartbeat',
                source: 'chrome_extension',
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            debugLog('心跳消息发送成功', 'success');
        } else {
            debugLog(`心跳消息发送失败: HTTP ${response.status}`, 'warning');
        }
    } catch (error) {
        debugLog(`心跳消息发送失败: ${error.message}`, 'warning');
    }
}

// 定期发送心跳消息到WebSocket（确保连接不断）
setInterval(() => {
    sendHeartbeat();
}, 30000); // 每30秒发送心跳

// 定期清理日志（防止内存泄漏）
setInterval(() => {
    if (debugMode) {
        debugLog('定期清理检查', 'info');
    }
}, 60000); // 每分钟检查一次 