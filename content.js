// Content Script - 悬浮价格曲线显示
let floatingChart = null;
let isChartVisible = false;
let priceData = [];

// 创建悬浮图表
function createFloatingChart() {
    if (floatingChart) return;
    
    // 创建悬浮容器
    floatingChart = document.createElement('div');
    floatingChart.id = 'floating-price-chart';
    floatingChart.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        height: 200px;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 10px;
        z-index: 10000;
        display: none;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 10px 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px 10px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
    `;
    
    const title = document.createElement('span');
    title.id = 'chart-title';
    title.textContent = '价格曲线';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeBtn.onclick = hideFloatingChart;
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 创建画布
    const canvas = document.createElement('canvas');
    canvas.id = 'floating-chart-canvas';
    canvas.style.cssText = `
        width: 100%;
        height: calc(100% - 40px);
        border-radius: 0 0 10px 10px;
    `;
    
    floatingChart.appendChild(header);
    floatingChart.appendChild(canvas);
    document.body.appendChild(floatingChart);
    
    // 添加拖拽功能
    makeDraggable(floatingChart, header);
}

// 使元素可拖拽
function makeDraggable(element, handle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    handle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === handle) {
            isDragging = true;
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            setTranslate(currentX, currentY, element);
        }
    }
    
    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
    
    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
}

// 显示悬浮图表
function showFloatingChart() {
    if (!floatingChart) {
        createFloatingChart();
    }
    
    floatingChart.style.display = 'block';
    isChartVisible = true;
    updateFloatingChart();
}

// 隐藏悬浮图表
function hideFloatingChart() {
    if (floatingChart) {
        floatingChart.style.display = 'none';
        isChartVisible = false;
    }
}

// 更新悬浮图表
function updateFloatingChart() {
    if (!isChartVisible || !floatingChart) return;
    
    const canvas = document.getElementById('floating-chart-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    if (priceData.length < 2) {
        // 显示无数据提示
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
        return;
    }
    
    // 计算价格范围
    const prices = priceData.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    if (priceRange === 0) return;
    
    // 绘制网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // 绘制价格线
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    priceData.forEach((point, index) => {
        const x = (index / (priceData.length - 1)) * width;
        const y = height - ((point.price - minPrice) / priceRange) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // 绘制数据点
    ctx.fillStyle = '#4CAF50';
    priceData.forEach((point, index) => {
        const x = (index / (priceData.length - 1)) * width;
        const y = height - ((point.price - minPrice) / priceRange) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // 显示价格信息
    const currentPrice = priceData[priceData.length - 1].price;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`当前: $${currentPrice.toFixed(2)}`, 10, 20);
    
    if (priceData.length > 1) {
        const change = currentPrice - priceData[priceData.length - 2].price;
        const changePercent = (change / priceData[priceData.length - 2].price) * 100;
        const changeColor = change >= 0 ? '#4CAF50' : '#f44336';
        ctx.fillStyle = changeColor;
        ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`, 10, 35);
    }
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updatePriceData') {
        priceData = request.data;
        updateFloatingChart();
    } else if (request.action === 'showFloatingChart') {
        showFloatingChart();
    } else if (request.action === 'hideFloatingChart') {
        hideFloatingChart();
    }
});

// 添加键盘快捷键
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+P 显示/隐藏悬浮图表
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (isChartVisible) {
            hideFloatingChart();
        } else {
            showFloatingChart();
        }
    }
});

// 初始化
console.log('多币种价格监控器 Content Script 已加载');
console.log('使用 Ctrl+Shift+P 切换悬浮图表显示'); 