// Wasteland Market Terminal — ui.js (графики + фикс предсказаний)
let currentTab = 'items';
let calendarYear, calendarMonth;

document.getElementById('balanceInput').value = balance;
document.getElementById('balanceDisplay').textContent = balance.toFixed(2);

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const tabIndex = { items: 0, trades: 1, analytics: 2, events: 3, insights: 4 }[tab];
    document.querySelectorAll('.tab')[tabIndex].classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'trades') renderTrades();
    if (tab === 'analytics') { updateAnalyticsSelect(); renderAnalytics(); }
    if (tab === 'events') { initCalendar(); renderEvents(); }
    if (tab === 'insights') renderInsights();
}

// Предметы
function addItemForm() {
    const name = document.getElementById('newItemName').value.trim();
    const type = document.getElementById('newItemType').value.trim();
    if (!name) return;
    addItem(name, type);
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemType').value = '';
    renderItems();
}

function selectItem(name) {
    selectedItem = name;
    document.getElementById('priceEntry').style.display = 'block';
    document.getElementById('selectedItemName').textContent = name;
    const now = new Date();
    now.setHours(now.getHours() + 3);
    document.getElementById('entryTime').value = now.toISOString().slice(0, 16);
    renderItemAnalytics();
}

function submitPriceEntry() {
    const now = new Date();
    now.setHours(now.getHours() + 3);
    const time = document.getElementById('entryTime').value || now.toISOString().slice(0, 16);
    const buy = parseFloat(document.getElementById('entryBuy').value);
    const sell = parseFloat(document.getElementById('entrySell').value);
    const event = document.getElementById('entryEvent').value;
    const nerf = document.getElementById('entryNerf').checked;
    const buff = document.getElementById('entryBuff').checked;
    if (isNaN(buy) || isNaN(sell)) { alert('Введи цены'); return; }
    addPriceEntry(time, buy, sell, event, nerf, buff);
    document.getElementById('entryBuy').value = '';
    document.getElementById('entrySell').value = '';
    document.getElementById('entryNerf').checked = false;
    document.getElementById('entryBuff').checked = false;
    renderItemAnalytics();
    renderItems();
}

function renderItems() {
    const list = document.getElementById('itemsList');
    if (items.length === 0) {
        list.innerHTML = '<p style="color:#888;text-align:center;">Нет предметов.</p>';
        return;
    }
    list.innerHTML = items.map(item => {
        const itemTrades = trades.filter(t => t.item === item.name);
        const totalProfit = itemTrades.reduce((a, b) => a + b.profit, 0);
        const profitColor = totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)';
        return `<div class="item-list-item" onclick="selectItem('${item.name}')">
            <span>📦 ${item.name} <span style="color:#888;font-size:0.7em;">${item.type || ''}</span></span>
            <span style="font-size:0.8em;">
                ${(prices[item.name]||[]).length} зап. | 
                ${itemTrades.length} сделок | 
                <span style="color:${profitColor}">${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(1)}</span>
            </span>
        </div>`;
    }).join('');
    updateTradeSelect();
    updateInsightSelect();
    updateAnalyticsSelect();
}

function renderItemAnalytics() {
    if (!selectedItem) return;
    const data = prices[selectedItem] || [];
    const container = document.getElementById('itemAnalytics');
    if (data.length < 3) {
        container.innerHTML = '<p style="color:#888;font-size:0.8em;">📊 Нужно минимум 3 записи для аналитики. Сейчас: ' + data.length + '</p>';
        return;
    }
    const pred = getPrediction(selectedItem);
    const itemInsights = insights.filter(i => i.item === selectedItem);
    
    // Мини-график
    const buys = data.map(p => p.buy);
    const sells = data.map(p => p.sell);
    const allVals = buys.concat(sells);
    const maxVal = Math.max(...allVals);
    const minVal = Math.min(...allVals);
    const range = maxVal - minVal || 1;
    
    let graphHTML = '<div style="height:40px;display:flex;align-items:flex-end;gap:2px;margin:8px 0;">';
    data.forEach(p => {
        const buyH = ((p.buy - minVal) / range) * 100;
        const sellH = ((p.sell - minVal) / range) * 100;
        graphHTML += `<div style="flex:1;display:flex;flex-direction:column;gap:1px;">
            <div style="height:${sellH}%;background:var(--profit);opacity:0.5;border-radius:1px;" title="Продажа: ${p.sell}"></div>
            <div style="height:${buyH}%;background:var(--accent);border-radius:1px;" title="Покупка: ${p.buy}"></div>
        </div>`;
    });
    graphHTML += '</div>';
    
    // Линейный график тренда
    let lineGraph = '<svg width="100%" height="30" style="margin:4px 0;"><polyline points="';
    data.forEach((p, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * 100;
        const y = 28 - ((p.buy - minVal) / range) * 26;
        lineGraph += `${x},${y} `;
    });
    lineGraph += `" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>`;
    
    container.innerHTML = `
        <div style="font-size:0.7em;color:#888;">📈 Тренд цены покупки:</div>
        ${lineGraph}
        <div style="font-size:0.7em;color:#888;">📊 Объёмы (зелёный=продажа, оранж=покупка):</div>
        ${graphHTML}
        <div class="prediction ${pred.class}" style="font-size:0.85em;">${pred.text}</div>
        <div style="font-size:0.7em;color:#888;margin-top:4px;">
            Точность: ${getModelAccuracy(selectedItem)}% | Уверенность: ${(pred.confidence*100).toFixed(0)}%
        </div>
        ${itemInsights.length > 0 ? `<div style="margin-top:8px;font-size:0.75em;color:var(--accent);">💡 Инсайтов: ${itemInsights.length}</div>` : ''}`;
}

// Сделки
function updateTradeSelect() {
    const select = document.getElementById('tradeItemSelect');
    select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function submitTrade() {
    const item = document.getElementById('tradeItemSelect').value;
    const buyPrice = parseFloat(document.getElementById('tradeBuyPrice').value);
    const sellPrice = parseFloat(document.getElementById('tradeSellPrice').value);
    if (!item || isNaN(buyPrice) || isNaN(sellPrice)) { alert('Заполни все поля'); return; }
    addTrade(item, buyPrice, sellPrice);
    document.getElementById('tradeBuyPrice').value = '';
    document.getElementById('tradeSellPrice').value = '';
    renderTrades();
    renderItems();
}

function renderTrades() {
    const tbody = document.querySelector('#tradesTable tbody');
    tbody.innerHTML = trades.map((t, i) => `
        <tr>
            <td>📦 ${t.item}</td>
            <td>${t.buyPrice.toFixed(2)}</td>
            <td>${t.sellPrice.toFixed(2)}</td>
            <td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profit.toFixed(2)}</td>
            <td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profitPct.toFixed(1)}%</td>
            <td>${(t.confidence*100).toFixed(0)}%</td>
            <td><button class="delete-btn" onclick="deleteTrade(${i})">✕</button></td>
        </tr>
    `).join('');
    const totalProfit = trades.reduce((a,b) => a + b.profit, 0);
    const winRate = trades.length > 0 ? (trades.filter(t => t.profit > 0).length / trades.length * 100) : 0;
    document.getElementById('tradeStats').innerHTML = `
        <div class="stats-grid">
            <div class="stat-item"><div class="value" style="color:${totalProfit>=0?'var(--profit)':'var(--loss)'}">${totalProfit.toFixed(2)}</div><div class="label">ОБЩАЯ ПРИБЫЛЬ</div></div>
            <div class="stat-item"><div class="value">${trades.length}</div><div class="label">ВСЕГО СДЕЛОК</div></div>
            <div class="stat-item"><div class="value">${winRate.toFixed(0)}%</div><div class="label">УСПЕШНЫХ</div></div>
            <div class="stat-item"><div class="value">${getGlobalAccuracy()}%</div><div class="label">ТОЧНОСТЬ МОДЕЛИ</div></div>
        </div>`;
}

function deleteTrade(index) {
    trades.splice(index, 1);
    saveAll();
    renderTrades();
}

// Аналитика
function updateAnalyticsSelect() {
    const select = document.getElementById('analyticsItemSelect');
    select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function renderAnalytics() {
    const select = document.getElementById('analyticsItemSelect');
    const selectedItems = Array.from(select.selectedOptions).map(o => o.value);
    const container = document.getElementById('analyticsContent');
    if (selectedItems.length === 0) {
        container.innerHTML = '<p style="color:#888;">Выберите предметы для сравнения.</p>';
        return;
    }
    let allPrices = [];
    selectedItems.forEach(item => {
        (prices[item] || []).forEach(p => allPrices.push({ item, ...p }));
    });
    if (allPrices.length === 0) {
        container.innerHTML = '<p style="color:#888;">Нет данных для выбранных предметов.</p>';
        return;
    }
    allPrices.sort((a,b) => new Date(a.time) - new Date(b.time));
    const maxPrice = Math.max(...allPrices.map(p => p.buy));
    const minPrice = Math.min(...allPrices.map(p => p.buy));
    const range = maxPrice - minPrice || 1;

    // Группировка по дням
    const days = {};
    allPrices.forEach(p => {
        const day = p.time.slice(0, 10);
        if (!days[day]) days[day] = {};
        if (!days[day][p.item]) days[day][p.item] = [];
        days[day][p.item].push(p.buy);
    });

    // Столбцы + линия
    const dayKeys = Object.keys(days).sort();
    let barHTML = '<div style="display:flex;align-items:flex-end;gap:2px;height:60px;margin:8px 0;">';
    dayKeys.forEach(day => {
        barHTML += '<div style="flex:1;display:flex;flex-direction:column;gap:1px;align-items:center;">';
        selectedItems.forEach(item => {
            const vals = (days[day] || {})[item] || [];
            const avg = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
            const h = ((avg - minPrice) / range) * 100;
            const color = stringToColor(item);
            barHTML += `<div style="height:${h}%;width:60%;background:${color};border-radius:1px;" title="${item}: ${avg.toFixed(2)}"></div>`;
        });
        barHTML += '</div>';
    });
    barHTML += '</div>';

    // SVG линия для первого предмета
    let lineHTML = '';
    if (selectedItems.length === 1) {
        const item = selectedItems[0];
        const data = prices[item] || [];
        if (data.length >= 2) {
            const buys = data.map(p => p.buy);
            const maxB = Math.max(...buys);
            const minB = Math.min(...buys);
            const rng = maxB - minB || 1;
            lineHTML = '<svg width="100%" height="40" style="margin:4px 0;"><polyline points="';
            buys.forEach((b, i) => {
                const x = (i / Math.max(buys.length - 1, 1)) * 100;
                const y = 38 - ((b - minB) / rng) * 36;
                lineHTML += `${x},${y} `;
            });
            lineHTML += `" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>`;
        }
    }

    let statsHTML = '<div class="stats-grid">';
    selectedItems.forEach(item => {
        const data = prices[item] || [];
        if (data.length === 0) return;
        const buys = data.map(p => p.buy);
        const avgBuy = buys.reduce((a,b) => a+b, 0) / buys.length;
        statsHTML += `<div class="stat-item"><div class="value">${avgBuy.toFixed(2)}</div><div class="label">${item} (ср.)</div></div>`;
    });
    statsHTML += '</div>';
    container.innerHTML = lineHTML + barHTML + statsHTML;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 50%, 60%)`;
}

// События
function submitEvent() {
    const date = document.getElementById('eventDate').value;
    const type = document.getElementById('eventType').value;
    const desc = document.getElementById('eventDesc').value.trim();
    if (!date) return;
    addEvent(date, type, desc);
    document.getElementById('eventDesc').value = '';
    renderEvents();
    initCalendar();
}

function renderEvents() {
    const list = document.getElementById('eventsList');
    if (events.length === 0) { list.innerHTML = '<p style="color:#888;">Нет событий.</p>'; return; }
    const emoji = { factory: '🏭', rating_end: '⚔️', battlepass: '🎫', road: '🛣️', raven: '🐦‍⬛', workshop: '🔧', bounty: '🎯', nerf: '🔻', buff: '🔺', new_item: '🆕', distribution: '🎁' };
    const tagClass = { factory: 'tag-factory', rating_end: 'tag-rating', battlepass: 'tag-battlepass', road: 'tag-road', raven: 'tag-raven', workshop: 'tag-workshop', bounty: 'tag-bounty', nerf: 'tag-nerf', buff: 'tag-buff', distribution: 'tag-distribution' };
    list.innerHTML = events.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
            <span><span class="tag ${tagClass[e.type]||''}">${emoji[e.type]||'📌'}</span> ${e.date} — ${e.desc || e.type}</span>
            <button class="delete-btn" onclick="deleteEvent(${i});renderEvents();initCalendar();">✕</button>
        </div>
    `).join('');
}

function initCalendar() {
    const now = new Date();
    if (!calendarYear) { calendarYear = now.getFullYear(); calendarMonth = now.getMonth(); }
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendarWidget');
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay() || 7;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let html = '<div class="calendar-header">';
    html += `<button onclick="changeMonth(-1)">←</button>`;
    html += `<span>${new Date(calendarYear, calendarMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>`;
    html += `<button onclick="changeMonth(1)">→</button>`;
    html += '</div><div class="calendar-grid">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
    for (let i = 1; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const hasEvent = events.some(e => e.date === dateStr);
        const isToday = dateStr === todayStr;
        let cls = 'calendar-day';
        if (isToday) cls += ' today';
        if (hasEvent) cls += ' has-event';
        html += `<div class="${cls}" onclick="document.getElementById('eventDate').value='${dateStr}'">${day}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
}

// Инсайты
function updateInsightSelect() {
    const select = document.getElementById('insightItemSelect');
    select.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function submitInsight() {
    const item = document.getElementById('insightItemSelect').value;
    const text = document.getElementById('insightText').value.trim();
    if (!item || !text) { alert('Выбери предмет и напиши наблюдение'); return; }
    addInsight(item, text);
    document.getElementById('insightText').value = '';
    renderInsights();
}

function renderInsights() {
    const list = document.getElementById('insightsList');
    if (insights.length === 0) { list.innerHTML = '<p style="color:#888;">Нет инсайтов.</p>'; return; }
    list.innerHTML = insights.map((ins, i) => `
        <div class="insight-box">
            <div style="font-size:0.8em;color:var(--accent);margin-bottom:4px;">📦 ${ins.item} — ${new Date(ins.date).toLocaleDateString('ru-RU')}</div>
            <div>${ins.text}</div>
            <button class="delete-btn" onclick="deleteInsight(${i});renderInsights();" style="margin-top:4px;">✕</button>
        </div>
    `).join('');
}

// Инициализация
renderItems();
renderEvents();
updateTradeSelect();
updateInsightSelect();
updateAnalyticsSelect();
if (items.length > 0) selectItem(items[0].name);
