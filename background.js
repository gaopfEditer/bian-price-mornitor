// 后台服务脚本
let monitoringInterval = null;
let lastPrices = {};
let debugMode = false;
let currentCoin = 'ETHUSDT';
let volatilityData = {};
let popupConnected = false; // 跟踪popup连接状态

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
    // 不自动启动监控，等待用户手动启动
});

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
                popupConnected: popupConnected
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
                timestamp: new Date().toISOString()
            }
        });
    }
    
    return true; // 保持消息通道开放
});

// 启动监控
function startMonitoring() {
    debugLog(`启动价格监控，币种: ${currentCoin}`, 'info');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        debugLog('清除旧的监控定时器', 'info');
    }
    
    // 立即获取一次价格并发送到popup
    fetchPrice().then(() => {
        debugLog('初始价格已发送到popup', 'success');
    }).catch(error => {
        debugLog(`初始价格获取失败: ${error.message}`, 'error');
    });
    
    // 每5秒获取一次价格
    monitoringInterval = setInterval(() => {
        debugLog('定时获取价格', 'info');
        fetchPrice();
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
            debugLog(`获取到价格: $${currentPrice}`, 'success');
            
            // 更新最后价格
            lastPrices[currentCoin] = currentPrice;
            
            // 更新badge显示价格
            updateBadge(currentPrice);
            
            // 发送价格更新到popup - 使用更可靠的方式
            const message = {
                action: 'updatePrice',
                price: currentPrice.toFixed(2),
                coin: currentCoin,
                timestamp: new Date().toISOString()
            };
            
            debugLog(`发送价格更新消息: ${JSON.stringify(message)}`, 'info');
            
            // 尝试发送到所有可能的popup
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
    
    // 根据级别设置不同的通知样式
    const notificationConfig = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `${coin} 波动率提醒`,
        message: message,
        priority: level // 使用级别作为优先级
    };
    
    // 根据级别设置不同的图标颜色
    const levelColors = {
        1: '#4CAF50', // 绿色
        2: '#FF9800', // 橙色
        3: '#FF5722', // 红色
        4: '#E91E63', // 粉色
        5: '#9C27B0'  // 紫色
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
    
    // 发送到popup显示
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
            
            // 检查是否达到提醒条件
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
        
        // 显示通知并移除已触发的提醒
        triggeredAlerts.forEach(triggered => {
            debugLog(`发送通知: ${triggered.message}`, 'info');
            showNotification(triggered.message);
        });
        
        // 从后往前删除，避免索引变化
        triggeredAlerts.reverse().forEach(triggered => {
            alerts.splice(triggered.index, 1);
            debugLog(`移除已触发的提醒: ${triggered.alert.type} $${triggered.alert.price}`, 'info');
        });
        
        // 保存更新后的提醒列表
        chrome.storage.local.set({priceAlerts: alerts}, () => {
            debugLog(`保存更新后的提醒列表，剩余 ${alerts.length} 个提醒`, 'info');
        });
    });
}

// 显示通知
function showNotification(message) {
    debugLog(`创建通知: ${message}`, 'info');
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '价格提醒',
        message: message
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            debugLog(`通知创建失败: ${chrome.runtime.lastError.message}`, 'error');
        } else {
            debugLog(`通知创建成功，ID: ${notificationId}`, 'success');
        }
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
    // 可以在这里添加点击通知后的行为
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

// 定期清理日志（防止内存泄漏）
setInterval(() => {
    if (debugMode) {
        debugLog('定期清理检查', 'info');
    }
}, 60000); // 每分钟检查一次 