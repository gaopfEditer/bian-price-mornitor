// 弹窗脚本
document.addEventListener('DOMContentLoaded', function() {
  const currentPriceEl = document.getElementById('currentPrice');
  const priceChangeEl = document.getElementById('priceChange');
  const volatilityInfoEl = document.getElementById('volatilityInfo');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const statusEl = document.getElementById('status');
  const toggleBtn = document.getElementById('toggleMonitoring');
  const alertPriceInput = document.getElementById('alertPrice');
  const addAlertBtn = document.getElementById('addAlert');
  const alertListEl = document.getElementById('alertList');
  const volatilityThresholdInput = document.getElementById('volatilityThreshold');
  const setVolatilityBtn = document.getElementById('setVolatility');
  const priceChartCanvas = document.getElementById('priceChart');
  
  let isMonitoring = false;
  let selectedCoin = 'ETHUSDT';
  let lastPrice = null;
  let priceHistory = [];
  let chartInstance = null; // ECharts实例
  let volatilityThreshold = 1.0; // 默认1%
  let backgroundPort = null; // 与background的连接
  let currentMode = 'data'; // 当前模式：'data' 或 'view'
  let isViewModeActive = false; // 视图模式是否激活
  
  // 初始化
  loadAlerts();
  loadVolatilityThreshold();
  updateMonitoringStatus();
  initializeChart();
  setupCoinSelector();
  setupModeSelector();
  connectToBackground();
  
  // 设置模式选择器
  function setupModeSelector() {
    const dataModeBtn = document.getElementById('dataMode');
    const viewModeBtn = document.getElementById('viewMode');
    
    dataModeBtn.addEventListener('click', function() {
      switchMode('data');
    });
    
    viewModeBtn.addEventListener('click', function() {
      switchMode('view');
    });
  }
  
  // 切换模式
  function switchMode(mode) {
    if (currentMode === mode) {
      return;
    }
    
    console.log(`切换模式: ${currentMode} -> ${mode}`);
    
    // 更新按钮状态
    document.getElementById('dataMode').classList.toggle('active', mode === 'data');
    document.getElementById('viewMode').classList.toggle('active', mode === 'view');
    
    // 停止当前监控
    if (isMonitoring) {
      toggleMonitoring();
    }
    
    // 发送模式切换消息到后台
    chrome.runtime.sendMessage({
      action: 'switchMode',
      mode: mode
    }).then(response => {
      if (response && response.status === 'success') {
        currentMode = mode;
        isViewModeActive = false; // 切换模式时重置视图模式状态
        updateStatus(`已切换到${mode === 'data' ? '数据' : '视图'}模式`);
        
        // 更新监控按钮状态
        updateMonitoringButton();
        updateMonitoringStatus();
      }
    }).catch(error => {
      console.error('模式切换失败:', error);
      updateStatus('模式切换失败');
    });
  }
  
  // 更新监控按钮状态
  function updateMonitoringButton() {
    const toggleBtn = document.getElementById('toggleMonitoring');
    
    if (currentMode === 'view') {
      if (isViewModeActive) {
        toggleBtn.textContent = '停止监听';
        toggleBtn.disabled = false;
        toggleBtn.classList.remove('disabled');
      } else {
        toggleBtn.textContent = '开始监听';
        toggleBtn.disabled = false;
        toggleBtn.classList.remove('disabled');
      }
    } else {
      toggleBtn.textContent = isMonitoring ? '停止监控' : '开始监控';
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('disabled');
    }
  }
  
  // 设置币种选择器
  function setupCoinSelector() {
    const coinButtons = document.querySelectorAll('.coin-btn');
    coinButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        // 移除所有active类
        coinButtons.forEach(b => b.classList.remove('active'));
        // 添加active类到当前按钮
        this.classList.add('active');
        
        const newCoin = this.dataset.coin;
        console.log('切换到币种:', newCoin);
        
        // 更新选中的币种
        selectedCoin = newCoin;
        
        // 清空价格历史和最后价格
        priceHistory = [];
        lastPrice = null;
        
        // 清空显示
        currentPriceEl.textContent = '加载中...';
        priceChangeEl.textContent = '';
        volatilityInfoEl.textContent = '5小时波动率: 计算中...';
        
        // 更新图表
        updateChart();
        
        // 如果正在监控，通知后台更新币种并重新启动监控
        if (isMonitoring) {
          chrome.runtime.sendMessage({
            action: 'switchCoin', 
            coin: selectedCoin
          }).then(() => {
            // 立即获取新币种的价格
            fetchPrice();
          }).catch(() => {
            // 如果发送失败，直接获取价格
            fetchPrice();
          });
        } else {
          // 如果未监控，直接获取一次价格
          fetchPrice();
        }
      });
    });
  }
  
  // 初始化图表
  function initializeChart() {
    // 检查ECharts是否可用
    if (typeof echarts === 'undefined') {
      console.error('ECharts未加载');
      return;
    }
    
    // 初始化ECharts实例
    chartInstance = echarts.init(priceChartCanvas);
    
    // 设置图表配置
    const option = {
      backgroundColor: 'transparent',
      grid: {
        left: '10%',
        right: '10%',
        top: '15%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: [],
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.3)'
          }
        },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: 10
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.3)'
          }
        },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: 10,
          formatter: function(value) {
            return '$' + value.toFixed(0);
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        textStyle: {
          color: '#fff'
        },
        formatter: function(params) {
          if (params && params.length > 0) {
            const data = params[0];
            const index = data.dataIndex;
            if (index >= 0 && index < priceHistory.length) {
              const point = priceHistory[index];
              const time = new Date(point.timestamp).toLocaleTimeString();
              const price = point.price.toFixed(2);
              return `时间: ${time}<br/>价格: $${price}`;
            }
          }
          return '';
        }
      },
      series: [{
        name: '价格',
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: {
          color: '#4CAF50',
          width: 2
        },
        itemStyle: {
          color: '#4CAF50'
        },
        symbol: 'circle',
        symbolSize: 4,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0,
              color: 'rgba(76, 175, 80, 0.3)'
            }, {
              offset: 1,
              color: 'rgba(76, 175, 80, 0.1)'
            }]
          }
        }
      }]
    };
    
    chartInstance.setOption(option);
    
    // 监听窗口大小变化
    window.addEventListener('resize', function() {
      if (chartInstance) {
        chartInstance.resize();
      }
    });
    
    console.log('ECharts图表初始化完成');
  }
  
  // 更新图表
  function updateChart() {
    console.log(`更新图表 - 价格历史长度: ${priceHistory.length}`);
    
    if (!chartInstance) {
      console.log('ECharts实例不存在，跳过更新');
      return;
    }
    
    // 准备数据
    const chartData = priceHistory.map(point => point.price);
    
    // 准备时间轴标签
    const timeLabels = priceHistory.map(point => {
      const date = new Date(point.timestamp);
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    });
    
    console.log(`图表数据: ${chartData.length}个点`);
    console.log('时间轴标签:', timeLabels);
    console.log('图表数据样本:', chartData.slice(-3));
    
    // 更新图表配置
    const option = {
      xAxis: {
        data: timeLabels,
        axisLabel: {
          show: chartData.length > 1, // 只有多个点时才显示时间轴标签
          interval: Math.max(0, Math.floor(chartData.length / 5)) // 控制标签密度
        }
      },
      series: [{
        data: chartData
      }]
    };
    
    // 应用配置
    chartInstance.setOption(option);
    
    console.log('ECharts图表更新完成');
    
    // 发送数据到content script更新悬浮图表
    if (isMonitoring) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updatePriceData',
            data: priceHistory
          }).catch(() => {
            // 忽略发送失败的错误
          });
        }
      });
    }
  }
  
  // 获取当前价格
  function fetchPrice() {
    console.log(`fetchPrice调用 - 监控状态: ${isMonitoring}, 币种: ${selectedCoin}`);
    
    // 如果正在监控，不需要手动获取价格，因为background会自动获取
    if (isMonitoring) {
      console.log('正在监控中，跳过手动获取价格');
      return Promise.resolve();
    }
    
    console.log('获取价格...');
    
    return fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${selectedCoin}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        const price = parseFloat(data.price);
        const now = new Date();
        
        console.log(`获取到价格: ${selectedCoin} = $${price.toFixed(2)}`);
        
        currentPriceEl.textContent = `$${price.toFixed(2)}`;
        lastUpdateEl.textContent = `最后更新: ${now.toLocaleTimeString()}`;
        
        // 计算价格变化
        if (lastPrice !== null) {
          const change = price - lastPrice;
          const changePercent = (change / lastPrice) * 100;
          
          if (change > 0) {
            priceChangeEl.textContent = `+${change.toFixed(2)} (+${changePercent.toFixed(2)}%)`;
            priceChangeEl.style.color = '#4CAF50';
          } else if (change < 0) {
            priceChangeEl.textContent = `${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
            priceChangeEl.style.color = '#f44336';
          } else {
            priceChangeEl.textContent = '0.00 (0.00%)';
            priceChangeEl.style.color = '#fff';
          }
        }
        
        // 添加到价格历史
        priceHistory.push({
          price: price,
          timestamp: now.getTime()
        });
        
        console.log(`添加新价格点: $${price.toFixed(2)} at ${now.toLocaleTimeString()}`);
        console.log(`添加前价格历史长度: ${priceHistory.length - 1}`);
        
        // 保持最近5小时的数据（每分钟一个点，最多300个点）
        const fiveHoursAgo = now.getTime() - (5 * 60 * 60 * 1000);
        const beforeFilter = priceHistory.length;
        priceHistory = priceHistory.filter(p => p.timestamp > fiveHoursAgo);
        const afterFilter = priceHistory.length;
        
        console.log(`时间戳过滤: ${beforeFilter} -> ${afterFilter} (5小时前: ${new Date(fiveHoursAgo).toLocaleTimeString()})`);
        console.log(`过滤后价格历史长度: ${priceHistory.length}`);
        
        // 显示最近几个价格点的时间戳
        if (priceHistory.length > 0) {
          console.log('最近的价格点:');
          priceHistory.slice(-3).forEach((point, index) => {
            console.log(`  ${index + 1}. $${point.price.toFixed(2)} at ${new Date(point.timestamp).toLocaleTimeString()}`);
          });
        }
        
        // 更新图表
        updateChart();
        
        // 计算波动率
        calculateVolatility();
        
        lastPrice = price;
        
        // 检查价格提醒
        checkPriceAlerts(price);
        
        // 检查波动率提醒
        checkVolatilityAlerts();
      })
      .catch(error => {
        console.error('获取价格失败:', error);
        currentPriceEl.textContent = '获取失败';
        
        // 如果正在监控，不要显示错误状态，因为background可能还在正常工作
        if (!isMonitoring) {
        statusEl.textContent = '监控状态: 连接错误';
        }
      });
  }
  
  // 计算波动率
  function calculateVolatility() {
    if (priceHistory.length < 2) return;
    
    // 计算5小时内的平均价格
    const prices = priceHistory.map(p => p.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // 计算标准差
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    
    // 计算波动率（标准差/平均价格 * 100）
    const volatility = (standardDeviation / avgPrice) * 100;
    
    volatilityInfoEl.textContent = `5小时波动率: ${volatility.toFixed(2)}% (平均: $${avgPrice.toFixed(2)})`;
    
    // 发送波动率数据到后台
    chrome.runtime.sendMessage({
      action: 'updateVolatility',
      coin: selectedCoin,
      volatility: volatility,
      avgPrice: avgPrice
    }).catch(() => {
      // 忽略发送失败的错误
    });
  }
  
  // 检查波动率提醒
  function checkVolatilityAlerts() {
    if (priceHistory.length < 2) return;
    
    const prices = priceHistory.map(p => p.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    const volatility = (standardDeviation / avgPrice) * 100;
    
    // 检查是否达到波动率阈值
    if (volatility >= volatilityThreshold) {
      // 计算星级：基于阈值倍数，最多5星
      // 例如：阈值0.1%，波动率0.15% = 1.5倍 = 1星
      // 阈值0.1%，波动率0.25% = 2.5倍 = 2星
      const multiplier = volatility / volatilityThreshold;
      const level = Math.min(Math.floor(multiplier), 5); // 最多5级
      
      const message = `${selectedCoin} 波动率达到 ${volatility.toFixed(2)}% (阈值${volatilityThreshold}%的${multiplier.toFixed(1)}倍)，触发 ${level} 星通知`;
      
      chrome.runtime.sendMessage({
        action: 'volatilityAlert',
        coin: selectedCoin,
        volatility: volatility,
        level: level,
        threshold: volatilityThreshold,
        multiplier: multiplier,
        message: message
      }).catch(() => {
        // 忽略发送失败的错误
      });
    }
  }
  
  // 检查价格提醒
  function checkPriceAlerts(currentPrice) {
    chrome.storage.local.get(['priceAlerts'], function(result) {
      const alerts = result.priceAlerts || [];
      
      alerts.forEach((alert, index) => {
        const alertPrice = parseFloat(alert.price);
        
        // 检查是否达到提醒条件
        if (alert.type === 'above' && currentPrice >= alertPrice) {
          showNotification(`${selectedCoin} 价格提醒`, `${selectedCoin} 价格已达到 $${alertPrice}，当前价格: $${currentPrice.toFixed(2)}`);
          // 移除已触发的提醒
          alerts.splice(index, 1);
        } else if (alert.type === 'below' && currentPrice <= alertPrice) {
          showNotification(`${selectedCoin} 价格提醒`, `${selectedCoin} 价格已降至 $${alertPrice}，当前价格: $${currentPrice.toFixed(2)}`);
          // 移除已触发的提醒
          alerts.splice(index, 1);
        }
      });
      
      // 保存更新后的提醒列表
      chrome.storage.local.set({priceAlerts: alerts});
      renderAlerts();
    });
  }
  
  // 显示通知
  function showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message
    });
  }
  
  // 加载提醒列表
  function loadAlerts() {
    chrome.storage.local.get(['priceAlerts'], function(result) {
      const alerts = result.priceAlerts || [];
      renderAlerts();
    });
  }
  
  // 加载波动率阈值
  function loadVolatilityThreshold() {
    chrome.storage.local.get(['volatilityThreshold'], function(result) {
      if (result.volatilityThreshold) {
        volatilityThreshold = result.volatilityThreshold;
        volatilityThresholdInput.value = volatilityThreshold;
      }
    });
  }
  
  // 渲染提醒列表
  function renderAlerts() {
    chrome.storage.local.get(['priceAlerts'], function(result) {
      const alerts = result.priceAlerts || [];
      alertListEl.innerHTML = '';
      
      alerts.forEach((alert, index) => {
        const alertItem = document.createElement('div');
        alertItem.className = 'alert-item';
        alertItem.innerHTML = `
          <span>${alert.type === 'above' ? '高于' : '低于'} $${alert.price}</span>
          <button onclick="removeAlert(${index})">删除</button>
        `;
        alertListEl.appendChild(alertItem);
      });
    });
  }
  
  // 添加提醒
  addAlertBtn.addEventListener('click', function() {
    const price = alertPriceInput.value.trim();
    if (!price || isNaN(price)) {
      alert('请输入有效的价格');
      return;
    }
    
    chrome.storage.local.get(['priceAlerts'], function(result) {
      const alerts = result.priceAlerts || [];
      
      // 添加两个提醒：高于和低于
      alerts.push({
        price: parseFloat(price),
        type: 'above'
      });
      
      alerts.push({
        price: parseFloat(price),
        type: 'below'
      });
      
      chrome.storage.local.set({priceAlerts: alerts}, function() {
        alertPriceInput.value = '';
        renderAlerts();
      });
    });
  });
  
  // 删除提醒
  window.removeAlert = function(index) {
    chrome.storage.local.get(['priceAlerts'], function(result) {
      const alerts = result.priceAlerts || [];
      alerts.splice(index, 1);
      chrome.storage.local.set({priceAlerts: alerts}, function() {
        renderAlerts();
      });
    });
  };
  
  // 设置波动率阈值
  setVolatilityBtn.addEventListener('click', function() {
    const threshold = parseFloat(volatilityThresholdInput.value);
    if (isNaN(threshold) || threshold < 0.1 || threshold > 5) {
      alert('请输入0.1-5之间的有效波动率阈值');
      return;
    }
    
    volatilityThreshold = threshold;
    chrome.storage.local.set({volatilityThreshold: threshold}, function() {
      console.log('波动率阈值已设置为:', threshold);
    });
  });
  
  // 切换监控状态
  toggleBtn.addEventListener('click', function() {
    if (currentMode === 'view') {
      // 视图模式：开始/停止监听
      if (isViewModeActive) {
        console.log('停止视图模式监听');
        isViewModeActive = false;
        updateMonitoringStatus();
        
        // 停止监听
        chrome.runtime.sendMessage({action: 'stopMonitoring'}).then(response => {
          console.log('监听停止结果:', response);
        }).catch(error => {
          console.error('停止监听失败:', error);
          // 如果停止失败，恢复状态
          isViewModeActive = true;
          updateMonitoringStatus();
        });
      } else {
        console.log('启动视图模式监听');
        isViewModeActive = true;
        updateMonitoringStatus();
        
        // 开始监听
        chrome.runtime.sendMessage({action: 'startMonitoring'}).then(response => {
          console.log('监听启动结果:', response);
        }).catch(error => {
          console.error('启动监听失败:', error);
          // 如果启动失败，恢复状态
          isViewModeActive = false;
          updateMonitoringStatus();
        });
      }
    } else {
      // 数据模式：开始/停止监控
      isMonitoring = !isMonitoring;
      updateMonitoringStatus();
      
      if (isMonitoring) {
        console.log('启动监控，币种:', selectedCoin);
        
        // 启动监控
        chrome.runtime.sendMessage({action: 'startMonitoring', coin: selectedCoin}).then(response => {
          console.log('监控启动结果:', response);
          
          // 立即获取一次价格作为初始数据
          fetchPrice();
          
          // 显示悬浮图表
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'showFloatingChart'
              }).catch(() => {
                // 忽略发送失败的错误
              });
            }
          });
        }).catch(error => {
          console.error('启动监控失败:', error);
          // 如果启动失败，回退到手动模式
          isMonitoring = false;
          updateMonitoringStatus();
        });
      } else {
        console.log('停止监控');
        
        // 停止监控
        chrome.runtime.sendMessage({action: 'stopMonitoring'}).then(response => {
          console.log('监控停止结果:', response);
          
          // 隐藏悬浮图表
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'hideFloatingChart'
              }).catch(() => {
                // 忽略发送失败的错误
              });
            }
          });
        }).catch(error => {
          console.error('停止监控失败:', error);
        });
      }
    }
  });
  
  // 更新监控状态显示
  function updateMonitoringStatus() {
    const modeText = currentMode === 'data' ? '数据模式' : '视图模式';
    
    if (currentMode === 'view') {
      if (isViewModeActive) {
        toggleBtn.textContent = '停止监听';
        toggleBtn.disabled = false;
        toggleBtn.classList.remove('disabled');
        statusEl.textContent = `监控状态: ${modeText} - 正在监听WebSocket数据`;
      } else {
        toggleBtn.textContent = '开始监听';
        toggleBtn.disabled = false;
        toggleBtn.classList.remove('disabled');
        statusEl.textContent = `监控状态: ${modeText} - 监听已停止`;
      }
    } else if (isMonitoring) {
      toggleBtn.textContent = '停止监控';
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('disabled');
      statusEl.textContent = `监控状态: ${modeText} - 正在监控 ${selectedCoin}`;
    } else {
      toggleBtn.textContent = '开始监控';
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('disabled');
      statusEl.textContent = `监控状态: ${modeText} - 未开始`;
    }
  }
  
  // 监听来自background script的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('收到消息:', request.action, request);
    
    if (request.action === 'updatePrice') {
      console.log(`处理价格更新: ${request.coin} = $${request.price}`);
      
      // 只处理当前选中币种的价格更新
      if (request.coin === selectedCoin) {
        const price = parseFloat(request.price);
        const timestamp = request.timestamp ? new Date(request.timestamp).getTime() : Date.now();
        const now = new Date(timestamp);
        
        console.log(`更新价格显示: ${selectedCoin} = $${price.toFixed(2)}`);
        
        // 更新价格显示
        currentPriceEl.textContent = `$${price.toFixed(2)}`;
        lastUpdateEl.textContent = `最后更新: ${now.toLocaleTimeString()}`;
        
        // 计算价格变化
        if (lastPrice !== null) {
          const change = price - lastPrice;
          const changePercent = (change / lastPrice) * 100;
          
          if (change > 0) {
            priceChangeEl.textContent = `+${change.toFixed(2)} (+${changePercent.toFixed(2)}%)`;
            priceChangeEl.style.color = '#4CAF50';
          } else if (change < 0) {
            priceChangeEl.textContent = `${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
            priceChangeEl.style.color = '#f44336';
          } else {
            priceChangeEl.textContent = '0.00 (0.00%)';
            priceChangeEl.style.color = '#fff';
          }
        }
        
        // 添加到价格历史
        priceHistory.push({
          price: price,
          timestamp: timestamp
        });
        
        console.log(`添加新价格点: $${price.toFixed(2)} at ${now.toLocaleTimeString()}`);
        console.log(`添加前价格历史长度: ${priceHistory.length - 1}`);
        
        // 保持最近5小时的数据（每分钟一个点，最多300个点）
        const fiveHoursAgo = now.getTime() - (5 * 60 * 60 * 1000);
        const beforeFilter = priceHistory.length;
        priceHistory = priceHistory.filter(p => p.timestamp > fiveHoursAgo);
        const afterFilter = priceHistory.length;
        
        console.log(`时间戳过滤: ${beforeFilter} -> ${afterFilter} (5小时前: ${new Date(fiveHoursAgo).toLocaleTimeString()})`);
        console.log(`过滤后价格历史长度: ${priceHistory.length}`);
        
        // 显示最近几个价格点的时间戳
        if (priceHistory.length > 0) {
          console.log('最近的价格点:');
          priceHistory.slice(-3).forEach((point, index) => {
            console.log(`  ${index + 1}. $${point.price.toFixed(2)} at ${new Date(point.timestamp).toLocaleTimeString()}`);
          });
        }
        
        // 更新图表
        updateChart();
        
        // 计算波动率
        calculateVolatility();
        
        lastPrice = price;
        
        // 检查价格提醒
        checkPriceAlerts(price);
        
        // 检查波动率提醒
        checkVolatilityAlerts();
        
        // 发送响应确认
        sendResponse({status: 'success', message: '价格更新已处理'});
      } else {
        console.log(`忽略其他币种的价格更新: ${request.coin} (当前选中: ${selectedCoin})`);
        sendResponse({status: 'ignored', message: '币种不匹配'});
      }
    } else if (request.action === 'volatilityAlert') {
      console.log('处理波动率提醒:', request);
      showNotification(request.title, request.message);
      sendResponse({status: 'success'});
    } else if (request.action === 'priceError') {
      console.error('价格获取错误:', request.error);
      currentPriceEl.textContent = '获取失败';
      statusEl.textContent = '监控状态: 连接错误';
      sendResponse({status: 'error', message: request.error});
    } else if (request.action === 'debugLog') {
      // 处理调试日志
      console.log(`[DEBUG] ${request.message}`);
      sendResponse({status: 'success'});
    } else {
      console.log('未知消息类型:', request.action);
      sendResponse({status: 'unknown', message: '未知消息类型'});
    }
    
    // 返回true表示异步处理
    return true;
  });
  
  // 初始化时获取最新数据
  function initializeData() {
    console.log('初始化数据...');
    
    // 获取当前监控状态
    chrome.runtime.sendMessage({action: 'getStatus'}).then(response => {
      if (response && response.data) {
        console.log('获取到状态:', response.data);
        
        // 更新监控状态
        isMonitoring = !!response.data.monitoringInterval;
        isViewModeActive = !!response.data.isViewModeActive;
        currentMode = response.data.currentMode || 'data';
        updateMonitoringStatus();
        
        // 如果有最新价格，立即更新显示
        if (response.data.lastPrices && response.data.lastPrices[selectedCoin]) {
          const price = response.data.lastPrices[selectedCoin];
          console.log(`使用缓存价格: ${selectedCoin} = $${price}`);
          
          currentPriceEl.textContent = `$${price.toFixed(2)}`;
          lastPrice = price;
          
          // 添加到价格历史（如果为空）
          if (priceHistory.length === 0) {
            const now = new Date();
            priceHistory.push({
              price: price,
              timestamp: now.getTime()
            });
            console.log(`添加缓存价格到历史: $${price.toFixed(2)} at ${now.toLocaleTimeString()}`);
            updateChart();
          }
          
          // 如果正在监控，等待background发送最新价格
          if (isMonitoring) {
            console.log('正在监控中，等待background发送最新价格');
          } else {
            // 如果不在监控中，获取一次价格作为初始显示
            console.log('不在监控中，获取一次价格作为初始显示');
            fetchPrice();
          }
        } else if (isMonitoring) {
          // 如果正在监控但没有缓存价格，等待background发送
          console.log('正在监控中但没有缓存价格，等待background发送');
        } else {
          // 如果不在监控中，也获取一次价格作为初始显示
          console.log('不在监控中，获取一次价格作为初始显示');
          fetchPrice();
        }
      } else {
        console.log('没有获取到状态，直接获取价格');
        fetchPrice();
      }
    }).catch(error => {
      console.error('获取状态失败:', error);
      // 如果获取状态失败，直接获取一次价格
      fetchPrice();
    });
  }
  
  // 初始获取价格
  console.log('开始初始化...');
  
  // 初始化数据
  initializeData();
  
  // 连接到background script
  function connectToBackground() {
    try {
      backgroundPort = chrome.runtime.connect({name: 'popup'});
      console.log('已连接到background script');
      
      backgroundPort.onMessage.addListener(function(message) {
        console.log('收到background消息:', message);
        // 处理来自background的消息
      });
      
      backgroundPort.onDisconnect.addListener(function() {
        console.log('与background的连接已断开');
        backgroundPort = null;
        // 尝试重新连接
        setTimeout(connectToBackground, 1000);
      });
    } catch (error) {
      console.error('连接background失败:', error);
    }
  }
}); 